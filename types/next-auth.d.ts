import type { DefaultSession } from "next-auth";

type UserRole = "USER" | "ADMIN";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      disabledAt?: Date | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    disabledAt?: Date | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    disabledAt?: string | null;
  }
}
