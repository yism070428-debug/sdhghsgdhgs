import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getCurrentAdmin } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const password = searchParams.get("password");

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        answers: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            authorName: true,
            content: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!post) {
      return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
    }

    // 관리자 확인
    const admin = await getCurrentAdmin();
    const isAdmin = Boolean(admin);

    // 비밀글 검증 로직
    if (post.isSecret && !isAdmin) {
      if (!password) {
        return NextResponse.json({
          requiresPassword: true,
          post: {
            id: post.id,
            authorName: post.authorName,
            category: post.category,
            isSecret: true,
            status: post.status,
            createdAt: post.createdAt,
            title: "🔒 비밀글입니다.",
          },
        });
      }

      const isMatch = await bcrypt.compare(password, post.passwordHash);
      if (!isMatch) {
        return NextResponse.json(
          { error: "비밀번호가 일치하지 않습니다.", requiresPassword: true },
          { status: 401 }
        );
      }
    }

    // 조회수 증가 (비동기)
    await prisma.post.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    return NextResponse.json({
      post: {
        id: post.id,
        title: post.title,
        content: post.content,
        authorName: post.authorName,
        category: post.category,
        isSecret: post.isSecret,
        status: post.status,
        viewCount: post.viewCount + 1,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        answers: post.answers,
        isAdmin,
      },
    });
  } catch (error: any) {
    console.error("Failed to get post:", error);
    return NextResponse.json({ error: "게시글을 불러오는데 실패했습니다." }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { password, title, content, category, isSecret } = body;

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
    }

    const admin = await getCurrentAdmin();
    const isAdmin = Boolean(admin);

    if (!isAdmin) {
      if (!password) {
        return NextResponse.json({ error: "비밀번호를 입력해주세요." }, { status: 400 });
      }
      const isMatch = await bcrypt.compare(password, post.passwordHash);
      if (!isMatch) {
        return NextResponse.json({ error: "비밀번호가 일치하지 않습니다." }, { status: 401 });
      }
    }

    const updated = await prisma.post.update({
      where: { id },
      data: {
        ...(title && { title: title.trim() }),
        ...(content && { content: content.trim() }),
        ...(category && { category }),
        ...(typeof isSecret === "boolean" && { isSecret }),
      },
    });

    return NextResponse.json({ post: updated });
  } catch (error: any) {
    console.error("Failed to update post:", error);
    return NextResponse.json({ error: "게시글 수정에 실패했습니다." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const password = searchParams.get("password");

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
    }

    const admin = await getCurrentAdmin();
    const isAdmin = Boolean(admin);

    if (!isAdmin) {
      if (!password) {
        return NextResponse.json({ error: "비밀번호를 입력해주세요." }, { status: 400 });
      }
      const isMatch = await bcrypt.compare(password, post.passwordHash);
      if (!isMatch) {
        return NextResponse.json({ error: "비밀번호가 일치하지 않습니다." }, { status: 401 });
      }
    }

    await prisma.post.delete({ where: { id } });

    return NextResponse.json({ message: "게시글이 삭제되었습니다." });
  } catch (error: any) {
    console.error("Failed to delete post:", error);
    return NextResponse.json({ error: "게시글 삭제에 실패했습니다." }, { status: 500 });
  }
}

