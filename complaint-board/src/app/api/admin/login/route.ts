import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createAdminToken } from "@/lib/auth";
import { ADMIN_COOKIE_NAME } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "아이디와 비밀번호를 입력해주세요." }, { status: 400 });
    }

    const admin = await prisma.admin.findUnique({
      where: { username },
    });

    if (!admin) {
      return NextResponse.json({ error: "관리자 계정을 찾을 수 없습니다." }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ error: "비밀번호가 일치하지 않습니다." }, { status: 401 });
    }

    const token = await createAdminToken({
      id: admin.id,
      username: admin.username,
      name: admin.name,
    });

    const response = NextResponse.json({
      message: "로그인 성공",
      admin: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
      },
    });

    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24, // 24시간
      sameSite: "lax",
    });

    return response;
  } catch (error: any) {
    console.error("Admin login error:", error);
    return NextResponse.json({ error: "로그인 처리에 실패했습니다." }, { status: 500 });
  }
}

