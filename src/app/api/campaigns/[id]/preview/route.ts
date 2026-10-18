import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { renderPersonalizedString, extractPlaceholders } from "@/lib/personalization";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const url = new URL(req.url);
    const contactId = url.searchParams.get("contactId");

    const campaign = await prisma.campaign.findUnique({
      where: { id: params.id },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Sample contact or specific contact
    let contact = null;
    if (contactId) {
      contact = await prisma.contact.findUnique({ where: { id: contactId } });
    }
    if (!contact) {
      contact = await prisma.contact.findFirst({
        where: { status: "subscribed" },
        orderBy: { createdAt: "desc" },
      });
    }

    // Extract placeholders present in subject and HTML content
    const subjectPlaceholders = extractPlaceholders(campaign.subject);
    const bodyPlaceholders = extractPlaceholders(campaign.htmlContent);
    const allPlaceholders = Array.from(new Set([...subjectPlaceholders, ...bodyPlaceholders]));

    const contactData = contact
      ? {
          email: contact.email,
          name: contact.fullName || contact.firstName || "Valued Contact",
          firstName: contact.firstName,
          lastName: contact.lastName,
          department: contact.department,
          organization: contact.organization,
          jobTitle: contact.jobTitle,
          customAttributes: contact.customAttributes,
        }
      : {
          email: "sample.user@example.com",
          name: "Sample User",
          firstName: "Sample",
          lastName: "User",
          department: "Engineering",
          organization: "Tech Corp",
          jobTitle: "Senior Lead",
          customAttributes: JSON.stringify({ dept_name: "Engineering", designation: "Senior Lead" }),
        };

    const renderedSubject = renderPersonalizedString(campaign.subject, contactData);
    const renderedHtml = renderPersonalizedString(campaign.htmlContent, contactData, { isHtml: true });

    return NextResponse.json({
      renderedSubject,
      renderedHtml,
      sampleContact: contactData,
      detectedPlaceholders: allPlaceholders,
    });
  } catch (error: unknown) {
    console.error("Preview error:", error);
    return NextResponse.json({ error: "Failed to generate preview" }, { status: 500 });
  }
}
