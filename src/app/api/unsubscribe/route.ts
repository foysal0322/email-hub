import { NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/tracking";
import { handleUnsubscribeEvent } from "@/lib/suppression";

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const verification = verifyUnsubscribeToken(token);
    if (!verification.valid || !verification.email) {
      return NextResponse.json({ error: "Invalid or expired unsubscribe token" }, { status: 400 });
    }

    await handleUnsubscribeEvent({
      email: verification.email,
      reason: "One-Click List-Unsubscribe Header Request",
      source: "rfc8058_one_click",
      campaignId: verification.campaignId,
    });

    return NextResponse.json({
      success: true,
      message: "Successfully unsubscribed",
      email: verification.email,
    });
  } catch (error: unknown) {
    console.error("Unsubscribe POST error:", error);
    return NextResponse.json({ error: "Failed to process unsubscribe" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(new URL("/unsubscribe?error=missing_token", req.url));
    }

    const verification = verifyUnsubscribeToken(token);
    if (!verification.valid || !verification.email) {
      return NextResponse.redirect(new URL("/unsubscribe?error=invalid_token", req.url));
    }

    // Process unsubscribe
    await handleUnsubscribeEvent({
      email: verification.email,
      reason: "User clicked unsubscribe link in email",
      source: "email_footer_link",
      campaignId: verification.campaignId,
    });

    return NextResponse.redirect(
      new URL(`/unsubscribe?success=true&email=${encodeURIComponent(verification.email)}`, req.url)
    );
  } catch (error: unknown) {
    console.error("Unsubscribe GET error:", error);
    return NextResponse.redirect(new URL("/unsubscribe?error=server_error", req.url));
  }
}
