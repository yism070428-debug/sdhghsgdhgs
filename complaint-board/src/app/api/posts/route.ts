import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const where: any = {};

    if (category && category !== "전체") {
      where.category = category;
    }

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (search && search.trim()) {
      where.OR = [
        { title: { contains: search.trim() } },
        { authorName: { contains: search.trim() } },
      ];
    }

    const totalCount = await prisma.post.count({ where });

    const posts = await prisma.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        authorName: true,
        category: true,
        isSecret: true,
        status: true,
        viewCount: true,
        createdAt: true,
        answers: {
          select: {
            id: true,
            createdAt: true,
            authorName: true,
          },
        },
      },
    });

    const sanitizedPosts = posts.map((post) => ({
      id: post.id,
      title: post.isSecret ? "🔒 비밀글입니다." : post.title,
      originalTitle: post.title, // 비밀글 여부 표시용 플래그와 함께 사용
      authorName: post.authorName,
      category: post.category,
      isSecret: post.isSecret,
      status: post.status,
      viewCount: post.viewCount,
      createdAt: post.createdAt,
      hasAnswer: post.answers.length > 0,
    }));

    return NextResponse.json({
      posts: sanitizedPosts,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error: any) {
    console.error("Failed to fetch posts:", error);
    return NextResponse.json({ error: "게시글 목록을 불러오는데 실패했습니다." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, content, authorName, password, category, isSecret } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "제목을 입력해주세요." }, { status: 400 });
    }

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });
    }

    if (!password || password.length < 4) {
      return NextResponse.json(
        { error: "비밀번호는 최소 4자리 이상이어야 합니다. (글 수정/삭제/비밀글 조회용)" },
        { status: 400 }
      );
    }

    // IP 해시 생성 (도배 방지용)
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";
    const clientIpHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newPost = await prisma.post.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        authorName: (authorName && authorName.trim()) || "익명",
        passwordHash,
        category: category || "일반",
        isSecret: Boolean(isSecret),
        status: "WAITING",
        clientIpHash,
      },
      select: {
        id: true,
        title: true,
        authorName: true,
        category: true,
        isSecret: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ post: newPost }, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create post:", error);
    return NextResponse.json({ error: "게시글 등록에 실패했습니다." }, { status: 500 });
  }
}

