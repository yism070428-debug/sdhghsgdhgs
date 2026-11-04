import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    const where: any = {};
    if (status && status !== "ALL") where.status = status;
    if (category && category !== "전체") where.category = category;
    if (search && search.trim()) {
      where.OR = [
        { title: { contains: search.trim() } },
        { content: { contains: search.trim() } },
        { authorName: { contains: search.trim() } },
      ];
    }

    // 상태별 통계 계산
    const [totalCount, waitingCount, processingCount, completedCount, rejectedCount] =
      await Promise.all([
        prisma.post.count(),
        prisma.post.count({ where: { status: "WAITING" } }),
        prisma.post.count({ where: { status: "PROCESSING" } }),
        prisma.post.count({ where: { status: "COMPLETED" } }),
        prisma.post.count({ where: { status: "REJECTED" } }),
      ]);

    const filteredCount = await prisma.post.count({ where });

    const posts = await prisma.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        answers: {
          select: {
            id: true,
            authorName: true,
            content: true,
            createdAt: true,
          },
        },
      },
    });

    return NextResponse.json({
      stats: {
        total: totalCount,
        waiting: waitingCount,
        processing: processingCount,
        completed: completedCount,
        rejected: rejectedCount,
      },
      posts,
      pagination: {
        page,
        limit,
        totalCount: filteredCount,
        totalPages: Math.ceil(filteredCount / limit),
      },
    });
  } catch (error: any) {
    console.error("Admin posts fetch error:", error);
    return NextResponse.json({ error: "관리자 목록 조회에 실패했습니다." }, { status: 500 });
  }
}

