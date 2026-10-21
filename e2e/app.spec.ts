import { test, expect } from "@playwright/test";

test("opens straight to the map with no sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Food Tracker" })).toBeVisible();
  await expect(page.getByText(/55 places/)).toBeVisible();
  await expect(page.locator(".leaflet-container")).toBeVisible();
});

test("list search finds a place and the place page works", async ({ page }) => {
  await page.goto("/list");
  await page.getByLabel("Search places").fill("mangalore");
  await expect(page.getByText("1 of 55")).toBeVisible();
  await page.getByRole("link", { name: /Mangalore Pearl/ }).click();
  await expect(page.getByRole("heading", { name: "Mangalore Pearl" })).toBeVisible();
  await page.getByRole("button", { name: "Visited" }).click();
  await expect(page.getByRole("button", { name: "Visited" })).toHaveAttribute("aria-pressed", "true");
});

test("logging a visit persists across reloads", async ({ page }) => {
  await page.goto("/list");
  await page.getByRole("link", { name: /Yoichi/ }).click();
  await page.getByLabel("What did you have?").fill("Ramen");
  await page.getByRole("button", { name: "Save visit" }).click();
  await expect(page.getByText("Visits (1)")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Visits (1)")).toBeVisible();
  await expect(page.getByText("Ramen")).toBeVisible();
});

test("adding a place works and shows it in the list", async ({ page }) => {
  await page.goto("/add");
  await page.getByLabel("Name").fill("Test Dosa Corner");
  await page.getByRole("button", { name: "Add place" }).click();
  await expect(page.getByRole("heading", { name: "Test Dosa Corner" })).toBeVisible();
  await page.goto("/list");
  await expect(page.getByRole("link", { name: /Test Dosa Corner/ })).toBeVisible();
});

test("bad coordinates are rejected with a message", async ({ page }) => {
  await page.goto("/add");
  await page.getByLabel("Name").fill("X");
  await page.getByLabel(/Coordinates/).fill("not coordinates");
  await page.getByRole("button", { name: "Add place" }).click();
  await expect(page.getByText(/Coordinates should look like/)).toBeVisible();
});

test("near me shows places within range using a fake location", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 12.9716, longitude: 77.6068 }); // MG Road area
  await page.goto("/near");
  await page.getByRole("button", { name: "Find places near me" }).click();
  await expect(page.getByText(/\d+ nearby/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Krok Burgers/ })).toBeVisible();
});

test("no horizontal scrolling on any main screen", async ({ page }) => {
  for (const path of ["/", "/list", "/near", "/add"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("pasting a Google Maps link fills in the name and location", async ({ page }) => {
  await page.goto("/add");
  await page.getByLabel("Paste a link").fill(
    "https://www.google.com/maps/place/Test+Chaat+House/@12.97,77.64,17z/data=!3d12.9712!4d77.6411",
  );
  await page.getByRole("button", { name: "Fill in from link" }).click();
  await expect(page.getByLabel("Name")).toHaveValue("Test Chaat House");
  await expect(page.getByLabel(/Coordinates/)).toHaveValue("12.9712, 77.6411");
});

test("pasting an Instagram reel link keeps the link and asks for the name", async ({ page }) => {
  await page.goto("/add");
  await page.getByLabel("Paste a link").fill("https://www.instagram.com/reel/AbC123/?igsh=zzz");
  await page.getByRole("button", { name: "Fill in from link" }).click();
  await expect(page.getByLabel(/^Link, e.g./)).toHaveValue("https://www.instagram.com/reel/AbC123/");
  await expect(page.getByText(/type it below/)).toBeVisible();
});

test("an unrecognised link shows a message", async ({ page }) => {
  await page.goto("/add");
  await page.getByLabel("Paste a link").fill("https://example.com");
  await page.getByRole("button", { name: "Fill in from link" }).click();
  await expect(page.getByText(/does not look like/)).toBeVisible();
});
