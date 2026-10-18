import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const lists = await prisma.contactList.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { members: true } },
      },
    });

    const formatted = lists.map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description,
      contactCount: l._count.members,
      createdAt: l.createdAt,
    }));

    return NextResponse.json({ lists: formatted });
  } catch (error: unknown) {
    console.error("Lists GET error:", error);
    return NextResponse.json({ error: "Failed to fetch contact lists" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, description } = await req.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "List name is required" }, { status: 400 });
    }

    const list = await prisma.contactList.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
      },
    });

    return NextResponse.json({ success: true, list });
  } catch (error: unknown) {
    console.error("List POST error:", error);
    return NextResponse.json({ error: "Failed to create contact list" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "List ID is required" }, { status: 400 });

    await prisma.contactList.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("List DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete list" }, { status: 500 });
  }
}
