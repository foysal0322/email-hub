import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting EmailHub database seeding...");

  // 1. Seed Application Settings
  const settings = await prisma.applicationSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      smtpHost: "ujz58nc6cr4g.fips.yxbq.mail-manager-smtp.amazonaws.com",
      smtpPort: 587,
      smtpUsername: "inp-awalp2xcurrgakrl2uj6mtha",
      smtpPassword: "Nsu01_Sm1P_2026",
      smtpRegion: "us-east-1",
      defaultFromName: "EmailHub Team",
      defaultFromEmail: "notifications@example.com",
      defaultReplyTo: "support@example.com",
      appBaseUrl: "http://localhost:3000",
      maxSendRate: 14,
      maxSoftBounces: 3,
      trackOpens: true,
      trackClicks: true,
    },
    update: {
      smtpHost: "ujz58nc6cr4g.fips.yxbq.mail-manager-smtp.amazonaws.com",
      smtpPort: 587,
      smtpUsername: "inp-awalp2xcurrgakrl2uj6mtha",
      smtpPassword: "Nsu01_Sm1P_2026",
    },
  });
  console.log("Application settings configured with AWS SES SMTP credentials.");

  // 2. Seed Default Admin User
  const adminEmail = process.env.ADMIN_EMAIL || "admin@emailhub.local";
  const adminPassword = process.env.ADMIN_PASSWORD || "AdminPassword123!";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: "Lead Administrator",
      passwordHash,
      role: "admin",
    },
    update: {
      passwordHash,
    },
  });
  console.log(`Admin user created: ${admin.email} (Password: ${adminPassword})`);

  // 3. Seed Starter Email Templates
  const templates = [
    {
      name: "Corporate Announcement",
      description: "Clean modern design for company-wide news, feature launches, and updates.",
      category: "announcement",
      subject: "Important Update: {{dept_name}} Department Announcements",
      preheader: "Highlights and upcoming initiatives for this quarter.",
      htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Company Announcement</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 24px;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
    <tr>
      <td style="background-color: #4f46e5; padding: 32px 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">EmailHub Updates</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 24px;">
        <h2 style="color: #111827; font-size: 20px; margin-top: 0;">Hello {{name|there}},</h2>
        <p style="color: #4b5563; font-size: 15px; line-height: 24px;">
          This update is specifically relevant to your <strong>{{dept_name|General}}</strong> department.
        </p>
        <p style="color: #4b5563; font-size: 15px; line-height: 24px;">
          As an active <strong>{{designation|Team Member}}</strong>, your leadership in modern workflow adoption is critical to our continuous deliverability success.
        </p>
        <div style="margin: 28px 0; text-align: center;">
          <a href="https://example.com/portal" style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 6px; display: inline-block;">View Department Portal</a>
        </div>
        <p style="color: #6b7280; font-size: 14px; line-height: 20px;">
          If you have questions regarding this announcement, reply to this email or contact support.
        </p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f9fafb; padding: 20px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          Sent by EmailHub Production Delivery Service &bull; All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim(),
      plainTextContent:
        "Hello {{name}},\n\nThis update is relevant to your {{dept_name}} department. Your designation is {{designation}}.\n\nView details at: https://example.com/portal",
    },
    {
      name: "Product Newsletter",
      description: "Engaging weekly or monthly newsletter template with dual CTA blocks.",
      category: "newsletter",
      subject: "Monthly Innovation Digest — Edition #14",
      preheader: "Top stories, release notes, and performance tips.",
      htmlContent: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background-color: #fafafa; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 8px; border: 1px solid #eee;">
    <h2 style="color: #2563eb;">Monthly Innovation Digest</h2>
    <p>Hi {{name|Friend}},</p>
    <p>Welcome to this month's digest tailored for members in {{organization|our organization}}.</p>
    <p>We've launched major upgrades to deliverability monitoring, bounce isolation, and one-click campaign automation.</p>
    <p><a href="https://example.com/read-more" style="color: #2563eb; text-decoration: underline;">Read the full technical deep-dive &rarr;</a></p>
  </div>
</body>
</html>
      `.trim(),
      plainTextContent: "Hi {{name}},\n\nCheck out our latest update at https://example.com/read-more",
    },
  ];

  for (const t of templates) {
    const existing = await prisma.emailTemplate.findFirst({ where: { name: t.name } });
    if (!existing) {
      await prisma.emailTemplate.create({ data: t });
    }
  }
  console.log("Starter email templates seeded.");

  // 4. Seed Contact Lists
  const engList = await prisma.contactList.upsert({
    where: { id: "list_engineering" },
    create: {
      id: "list_engineering",
      name: "Engineering & Tech",
      description: "Core technical development and SQA team members",
    },
    update: {},
  });

  const mktList = await prisma.contactList.upsert({
    where: { id: "list_marketing" },
    create: {
      id: "list_marketing",
      name: "Marketing & Growth",
      description: "Marketing executives, campaign managers, and copywriters",
    },
    update: {},
  });

  // 5. Seed Initial Contacts (Matching the exact example in prompt: Alice Rahman & Bob Hasan)
  const initialContacts = [
    {
      email: "alice@example.com",
      normalizedEmail: "alice@example.com",
      fullName: "Alice Rahman",
      firstName: "Alice",
      lastName: "Rahman",
      department: "Engineering",
      organization: "TechCorp",
      jobTitle: "SQA Engineer",
      customAttributes: JSON.stringify({ dept_name: "Engineering", designation: "SQA Engineer" }),
      status: "subscribed",
      validationStatus: "valid_format",
      listId: engList.id,
    },
    {
      email: "bob@example.com",
      normalizedEmail: "bob@example.com",
      fullName: "Bob Hasan",
      firstName: "Bob",
      lastName: "Hasan",
      department: "Marketing",
      organization: "TechCorp",
      jobTitle: "Executive",
      customAttributes: JSON.stringify({ dept_name: "Marketing", designation: "Executive" }),
      status: "subscribed",
      validationStatus: "valid_format",
      listId: mktList.id,
    },
    {
      email: "charlie@example.com",
      normalizedEmail: "charlie@example.com",
      fullName: "Charlie Brown",
      firstName: "Charlie",
      lastName: "Brown",
      department: "Engineering",
      organization: "TechCorp",
      jobTitle: "Lead Architect",
      customAttributes: JSON.stringify({ dept_name: "Engineering", designation: "Lead Architect" }),
      status: "subscribed",
      validationStatus: "valid_format",
      listId: engList.id,
    },
    {
      email: "bounced-user@example.com",
      normalizedEmail: "bounced-user@example.com",
      fullName: "Dan Miller",
      firstName: "Dan",
      lastName: "Miller",
      department: "Finance",
      organization: "TechCorp",
      jobTitle: "Financial Analyst",
      customAttributes: JSON.stringify({ dept_name: "Finance", designation: "Financial Analyst" }),
      status: "bounced",
      validationStatus: "domain_valid",
      bounceCount: 3,
    },
  ];

  for (const c of initialContacts) {
    const listId = c.listId;
    const contactData = { ...c };
    delete contactData.listId;

    const contact = await prisma.contact.upsert({
      where: { normalizedEmail: c.normalizedEmail },
      create: contactData,
      update: contactData,
    });

    if (listId) {
      await prisma.contactListMember.upsert({
        where: { contactId_listId: { contactId: contact.id, listId } },
        create: { contactId: contact.id, listId },
        update: {},
      });
    }
  }
  console.log("Initial seed contacts and list memberships created.");

  // 6. Seed a Suppression Entry for the bounced contact
  await prisma.suppressionEntry.upsert({
    where: { email: "bounced-user@example.com" },
    create: {
      email: "bounced-user@example.com",
      category: "hard_bounce",
      reason: "550 5.1.1 User unknown / Mailbox does not exist",
      source: "smtp_response",
    },
    update: {},
  });
  console.log("Suppression entry seeded for bounced-user@example.com");

  console.log("Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
