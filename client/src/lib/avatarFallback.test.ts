import { afterEach, describe, expect, it } from "vitest";
import { initialsAvatarUri, initialsOf, installAvatarFallback, looksLikeAvatar } from "./avatarFallback";

describe("initialsOf", () => {
  it("takes the first and last initials", () => {
    expect(initialsOf("Aadithya Ullas")).toBe("AU");
    expect(initialsOf("raja")).toBe("R");
    expect(initialsOf("Bramha Dutt Vishwakarma")).toBe("BV");
    expect(initialsOf("  ")).toBe("?");
    expect(initialsOf(null)).toBe("?");
  });
});

describe("initialsAvatarUri", () => {
  it("builds an SVG data URI with the initials", () => {
    const uri = initialsAvatarUri("Aadithya Ullas", "#111", "#eee");
    expect(uri.startsWith("data:image/svg+xml")).toBe(true);
    expect(decodeURIComponent(uri)).toContain(">AU</text>");
  });
});

describe("installAvatarFallback", () => {
  let uninstall: (() => void) | null = null;
  afterEach(() => {
    uninstall?.();
    document.body.innerHTML = "";
  });

  const fail = (img: HTMLImageElement) => img.dispatchEvent(new Event("error"));

  it("swaps a failed round avatar for initials, once", () => {
    uninstall = installAvatarFallback();
    document.body.innerHTML = `<div class="rounded-full overflow-hidden"><img alt="Aadithya Ullas" src="https://lh3.googleusercontent.com/a/x=s96-c"></div>`;
    const img = document.querySelector("img")!;
    expect(looksLikeAvatar(img)).toBe(true);
    fail(img);
    expect(img.src.startsWith("data:image/svg+xml")).toBe(true);
    expect(img.dataset.avatarFallback).toBe("1");
    const swapped = img.src;
    fail(img);
    expect(img.src).toBe(swapped);
  });

  it("leaves other images alone (gallery photos, unnamed images)", () => {
    uninstall = installAvatarFallback();
    document.body.innerHTML = `<div class="rounded-xl"><img alt="Finals photo" src="https://example.com/a.jpg"></div><div class="rounded-full"><img alt="" src="https://example.com/b.jpg"></div>`;
    const [photo, unnamed] = Array.from(document.querySelectorAll("img"));
    fail(photo);
    fail(unnamed);
    expect(photo.src).toBe("https://example.com/a.jpg");
    expect(unnamed.src).toBe("https://example.com/b.jpg");
  });
});
