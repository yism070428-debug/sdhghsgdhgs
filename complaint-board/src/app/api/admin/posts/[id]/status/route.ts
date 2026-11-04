import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;
    const { status } = await req.json();

    if (!["WAITING", "PROCESSING", "COMPLETED", "REJECTED"].includes(status)) {
      return NextResponse.json({ error: "유효하지 않은 상태값입니다." }, { status: 400 });
    }

    const updated = await prisma.post.update({
      where: { id },
      data: { status },
      select: { id: true, status: true },
    });

    return NextResponse.json({ message: "상태가 변경되었습니다.", post: updated });
  } catch (error: any) {
    console.error("Status update error:", error);
    return NextResponse.json({ error: "상태 변경에 실패했습니다." }, { status: 500 });
  }
}

