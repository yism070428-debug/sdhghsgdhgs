import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/constants";

export async function POST() {
  const response = NextResponse.json({ message: "로그아웃 되었습니다." });
  response.cookies.delete(ADMIN_COOKIE_NAME);
  return response;
}

