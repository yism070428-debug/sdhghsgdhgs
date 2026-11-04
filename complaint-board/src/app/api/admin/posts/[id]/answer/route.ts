import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;
    const { content, authorName, nextStatus } = await req.json();

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "답변 내용을 입력해주세요." }, { status: 400 });
    }

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
    }

    // 이미 등록된 답변이 있는지 확인 (단일 답변 모델)
    const existingAnswer = await prisma.answer.findFirst({
      where: { postId: id },
    });

    let answer;
    if (existingAnswer) {
      answer = await prisma.answer.update({
        where: { id: existingAnswer.id },
        data: {
          content: content.trim(),
          authorName: authorName?.trim() || admin.name || "관리팀",
          adminId: admin.id,
        },
      });
    } else {
      answer = await prisma.answer.create({
        data: {
          postId: id,
          adminId: admin.id,
          authorName: authorName?.trim() || admin.name || "관리팀",
          content: content.trim(),
        },
      });
    }

    // 게시글 상태를 기본적으로 COMPLETED로 갱신 (지정된 nextStatus가 있으면 그것으로)
    const updatedStatus = nextStatus || "COMPLETED";
    await prisma.post.update({
      where: { id },
      data: { status: updatedStatus },
    });

    return NextResponse.json({ message: "답변이 등록되었습니다.", answer, status: updatedStatus });
  } catch (error: any) {
    console.error("Answer submission error:", error);
    return NextResponse.json({ error: "답변 등록에 실패했습니다." }, { status: 500 });
  }
}

