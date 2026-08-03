import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

// PATCH /api/super-admin/cms/contacts/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireRole(req, "SUPER_ADMIN");
    if (auth.error) return auth.error;

    const body = await req.json();
    
    const message = await prisma.contactMessage.findUnique({
      where: { id: params.id }
    });

    if (!message) {
      return NextResponse.json(
        { success: false, error: "Contact message not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.contactMessage.update({
      where: { id: params.id },
      data: {
        status: body.status !== undefined ? body.status : undefined,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    console.error("[CONTACTS_PATCH]", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Failed to update contact message" },
      { status: 500 }
    );
  }
}

// DELETE /api/super-admin/cms/contacts/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireRole(req, "SUPER_ADMIN");
    if (auth.error) return auth.error;

    await prisma.contactMessage.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, message: "Contact message deleted successfully" });
  } catch (error: unknown) {
    console.error("[CONTACTS_DELETE]", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Failed to delete contact message" },
      { status: 500 }
    );
  }
}
