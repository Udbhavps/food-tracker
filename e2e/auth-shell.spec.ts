import { test, expect } from "@playwright/test";

// The sign-in page itself works in any mode; redirects to it only happen in cloud mode (later phase).

test("sign-in controls are comfortably tappable on a phone", async ({ page }) => {
  await page.goto("/login");
  const google = page.getByRole("button", { name: "Continue with Google" });
  const box = await google.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
});

test("no horizontal scrolling on the sign-in page", async ({ page }) => {
  await page.goto("/login");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("a failed sign-in shows an error message", async ({ page }) => {
  await page.goto("/login?error=signin_failed");
  await expect(page.getByText("Sign-in did not complete")).toBeVisible();
});

test("the callback never redirects to another site", async ({ request }) => {
  const res = await request.get("/auth/callback?next=//evil.example", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers()["location"]).toMatch(/\/login\?error=signin_failed$/);
});

test("sign-out only works with POST", async ({ request }) => {
  const res = await request.get("/auth/signout", { maxRedirects: 0 });
  expect(res.status()).toBe(405);
});
