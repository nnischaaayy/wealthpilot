import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home page", () => {
  it("renders the WealthPilot heading", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: "WealthPilot" })).toBeInTheDocument();
  });
});
