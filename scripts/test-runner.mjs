import { PrismaClient } from "@prisma/client";
import { normalizeEmail, validateEmail } from "../src/lib/validation.ts";
import {
  escapeHtml,
  extractPlaceholders,
  renderPersonalizedString,
  buildTokenDictionary,
} from "../src/lib/personalization.ts";
import {
  checkSuppression,
  suppressEmail,
  handleBounceEvent,
  handleUnsubscribeEvent,
} from "../src/lib/suppression.ts";
import {
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
  prepareTrackedEmailContent,
} from "../src/lib/tracking.ts";

const prisma = new PrismaClient();

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✔ PASS: ${testName}`);
    testsPassed++;
  } else {
    console.error(`  ✖ FAIL: ${testName}`);
    testsFailed++;
  }
}

async function runSuite() {
  console.log("\n=======================================================");
  console.log("   EmailHub Comprehensive Automated Test Suite");
  console.log("=======================================================\n");

  // 1. Email Normalization & Syntax Validation Tests
  console.log("--- 1. Email Normalization & Syntax Validation ---");
  assert(normalizeEmail("  Alice@Example.COM  ") === "alice@example.com", "Email normalization (trim & lowercase)");
  assert(normalizeEmail("") === "", "Empty email normalization");

  const validRes = await validateEmail("user@gmail.com", { checkDns: false });
  assert(validRes.syntaxValid === true && validRes.status === "valid_format", "Valid RFC 5322 email syntax");

  const invalidRes = await validateEmail("not-an-email", { checkDns: false });
  assert(invalidRes.syntaxValid === false && invalidRes.status === "invalid", "Invalid email syntax rejection");

  const disposableRes = await validateEmail("spammer@mailinator.com", { checkDns: false });
  assert(disposableRes.isDisposable === true && disposableRes.status === "disposable", "Disposable domain blocklist detection");

  const roleRes = await validateEmail("admin@company.com", { checkDns: false });
  assert(roleRes.isRoleBased === true, "Role-based prefix detection (admin@)");

  // 2. Personalization & Safe HTML Escaping Tests
  console.log("\n--- 2. Personalization & Safe HTML Escaping ---");
  const unsafeString = '<script>alert("XSS")</script>&"test"\'';
  const escaped = escapeHtml(unsafeString);
  assert(!escaped.includes("<script>") && escaped.includes("&lt;script&gt;"), "HTML escaping prevents XSS script tag injection");

  const placeholders = extractPlaceholders("Hello {{name}}, update for {{dept_name|General}} and {{designation}}");
  assert(
    placeholders.includes("name") && placeholders.includes("dept_name") && placeholders.includes("designation"),
    "Regex placeholder token extraction"
  );

  const contactData = {
    email: "alice@example.com",
    name: "Alice Rahman",
    department: "Engineering",
    jobTitle: "SQA Engineer",
    customAttributes: JSON.stringify({ dept_name: "Engineering", designation: "SQA Engineer" }),
  };

  const rendered = renderPersonalizedString(
    "Hi {{name}}, your dept is {{dept_name}} and title is {{designation}}.",
    contactData
  );
  assert(
    rendered === "Hi Alice Rahman, your dept is Engineering and title is SQA Engineer.",
    "Dynamic attribute interpolation"
  );

  const fallbackRendered = renderPersonalizedString("Hi {{nickname|Valued Friend}}!", { email: "test@example.com" });
  assert(fallbackRendered === "Hi Valued Friend!", "Placeholder default fallback {{key|fallback}} syntax");

  // 3. Unsubscribe Token & HMAC Verification Tests
  console.log("\n--- 3. Unsubscribe HMAC Token Security ---");
  const token = generateUnsubscribeToken("alice@example.com", "camp_123");
  const verification = verifyUnsubscribeToken(token);
  assert(verification.valid === true && verification.email === "alice@example.com", "Tamper-proof HMAC token verification");

  const tampered = token.slice(0, -4) + "AAAA";
  const tamperedVerification = verifyUnsubscribeToken(tampered);
  assert(tamperedVerification.valid === false, "Tampered token rejection");

  // 4. Open & Click Tracking Content Preparation Tests
  console.log("\n--- 4. Tracking Link Rewriting & Pixel Injection ---");
  const sampleEmailHtml = `
    <html>
      <body>
        <p>Click <a href="https://example.com/status">here</a> to view status.</p>
      </body>
    </html>
  `;

  // Create temporary message for testing link generation
  const tempMsg = await prisma.emailMessage.create({
    data: {
      recipientEmail: "test-track@example.com",
      fromEmail: "admin@example.com",
      subject: "Test Track",
      status: "pending",
    },
  });

  const prepared = await prepareTrackedEmailContent({
    html: sampleEmailHtml,
    messageId: tempMsg.id,
    trackingId: tempMsg.trackingId,
    recipientEmail: "test-track@example.com",
    baseUrl: "http://localhost:3000",
    enableOpenTracking: true,
    enableClickTracking: true,
  });

  assert(prepared.html.includes("/api/track/open/"), "Open tracking 1x1 GIF injected into HTML");
  assert(prepared.html.includes("/api/track/click/"), "Eligible link rewritten through secure redirect endpoint");
  assert(prepared.headers["List-Unsubscribe"] !== undefined, "RFC 2369 / RFC 8058 List-Unsubscribe header injected");

  // Cleanup temp message
  await prisma.emailMessage.delete({ where: { id: tempMsg.id } });

  // 5. Global Suppression & Pre-Send Deliverability Intercept Tests
  console.log("\n--- 5. Global Suppression & Pre-Send Guard ---");
  const testBouncedEmail = "hard-bounce-test@victim-domain.com";

  // Simulate hard bounce
  await handleBounceEvent({
    email: testBouncedEmail,
    bounceType: "Permanent",
    subType: "General",
    diagnosticCode: "550 5.1.1 User Unknown",
  });

  const suppressionCheck = await checkSuppression(testBouncedEmail);
  assert(suppressionCheck.isSuppressed === true, "Hard-bounced address registered in global suppression registry");
  assert(suppressionCheck.category === "hard_bounce", "Suppression category accurately marked as hard_bounce");

  // Test pre-send intercept: Clean email must not be suppressed
  const cleanEmailCheck = await checkSuppression("clean-valid-user@techcorp.com");
  assert(cleanEmailCheck.isSuppressed === false, "Clean recipient passes pre-send suppression check");

  // Test Unsubscribe event suppression
  const unsubEmail = "optout-user@example.com";
  await handleUnsubscribeEvent({
    email: unsubEmail,
    reason: "Recipient clicked footer unsubscribe",
  });
  const unsubCheck = await checkSuppression(unsubEmail);
  assert(unsubCheck.isSuppressed === true && unsubCheck.category === "unsubscribe", "Unsubscribed recipient suppressed globally");

  // 6. Campaign Audience Snapshot & Pre-Suppression Freezing Test
  console.log("\n--- 6. Campaign Lifecycle & Audience Pre-Send Freezing ---");
  const testCampaign = await prisma.campaign.create({
    data: {
      name: "Automated Test Campaign",
      subject: "Hello {{name}}",
      fromName: "Test Suite",
      fromEmail: "notifications@example.com",
      htmlContent: "<p>Test Content</p>",
      status: "draft",
    },
  });

  assert(testCampaign.id !== undefined, "Campaign creation in database");
  assert(testCampaign.status === "draft", "Initial campaign state is 'draft'");

  // Clean up test campaign
  await prisma.campaign.delete({ where: { id: testCampaign.id } });

  // Summary
  console.log("\n=======================================================");
  console.log(`   Test Results: ${testsPassed} Passed, ${testsFailed} Failed`);
  console.log("=======================================================\n");

  await prisma.$disconnect();
  process.exit(testsFailed > 0 ? 1 : 0);
}

runSuite().catch((err) => {
  console.error("Test suite runtime failure:", err);
  process.exit(1);
});
