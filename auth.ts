import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import {
  assertAuthJsSecret,
  isGoogleOAuthConfigured,
  resolveOAuthSignIn,
  sessionFromOAuthClaims,
  type OAuthClaims,
} from "@/lib/oauth";

const googleConfigured = isGoogleOAuthConfigured();

assertAuthJsSecret({
  nodeEnv: process.env.NODE_ENV,
  oauthConfigured: googleConfigured,
  authSecret: process.env.AUTH_SECRET,
});

type TokenWithClearedClaims = {
  cleared?: OAuthClaims;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: googleConfigured
    ? [
        Google({
          clientId: process.env.AUTH_GOOGLE_ID,
          clientSecret: process.env.AUTH_GOOGLE_SECRET,
        }),
      ]
    : [],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      const result = await resolveOAuthSignIn({
        email: user.email ?? profile?.email,
        name: user.name ?? profile?.name,
        provider: account?.provider,
        providerAccountId: account?.providerAccountId,
        adminEmail: process.env.ADMIN_EMAIL,
      });
      if (!result.ok) return `/login?oauth=${result.reason}`;
      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (!account) return token;
      const result = await resolveOAuthSignIn({
        email: user.email ?? profile?.email,
        name: user.name ?? profile?.name,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        adminEmail: process.env.ADMIN_EMAIL,
      });
      if (!result.ok) return token;
      return {
        ...token,
        name: result.claims.name ?? token.name,
        email: result.claims.email,
        sub: `${result.claims.provider}:${result.claims.providerAccountId}`,
        cleared: result.claims,
      };
    },
    async session({ session, token }) {
      const claims = (token as TokenWithClearedClaims).cleared;
      if (!claims) return session;
      const unified = sessionFromOAuthClaims(claims);
      const nextSession = session as typeof session & typeof unified;
      Object.assign(nextSession, unified);
      nextSession.user = Object.assign({}, nextSession.user, {
        id: unified.userId,
        name: unified.name,
        email: unified.email ?? "",
        role: unified.role,
      });
      return nextSession;
    },
  },
});
