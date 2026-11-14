import { expect, test } from "@playwright/test";
import { plannedLinks, createSandboxLinks } from "../scripts/asaas-recurring-links.mjs";

test("provisioning plan is six sandbox-only recurring links with explicit monthly method", () => {
  const plans=plannedLinks();
  expect(plans).toHaveLength(6);
  expect(plans.map(p=>p.method)).toEqual(["pix","pix","pix","credit","credit","credit"]);
  for (const entry of plans) {
    expect(entry.payload.chargeType).toBe("RECURRENT");
    expect(entry.payload.subscriptionCycle).toBe("MONTHLY");
    expect(entry.payload.value).toBe(entry.amount);
    expect(["PIX","CREDIT_CARD"]).toContain(entry.payload.billingType);
    expect(JSON.stringify(entry.payload)).not.toMatch(/cpf|card_number|password|token|account/i);
  }
});

test("sandbox provisioning uses only fixed Asaas sandbox endpoint, no live merchant API", async () => {
  const requests: Array<{ url: string; options: RequestInit }> = [];
  const links=await createSandboxLinks({
    key:"A".repeat(32),
    fetchImpl:async (url: string | URL | Request, options: RequestInit) => {
      requests.push({url:String(url),options});
      return new Response(JSON.stringify({
        url:"https://sandbox.asaas.com/c/"+requests.length+"234567890",
      }),{status:200});
    },
  });
  expect(requests).toHaveLength(6);
  for (const request of requests) {
    expect(request.url).toBe("https://api-sandbox.asaas.com/v3/paymentLinks");
    expect(request.options.method).toBe("POST");
    expect(request.options.redirect).toBe("error");
    expect((request.options.headers as Record<string,string>).access_token).toBe("A".repeat(32));
  }
  expect(Object.keys(links.pix)).toEqual(["20","50","100"]);
  expect(Object.keys(links.credit)).toEqual(["20","50","100"]);
});

test("provider failure stops creation and never falls back to a live endpoint", async () => {
  let requests=0;
  await expect(createSandboxLinks({
    key:"A".repeat(32),
    fetchImpl:async () => {
      requests++;
      return new Response("private provider body",{status:403});
    },
  })).rejects.toThrow(/HTTP 403/);
  expect(requests).toBe(1);
  await expect(createSandboxLinks({key:"",fetchImpl:async ()=>{throw new Error("unreachable");}}))
    .rejects.toThrow(/Sandbox API key required/);
});

test("invalid provider redirect URL prevents reuse of arbitrary hosted destination", async () => {
  await expect(createSandboxLinks({
    key:"A".repeat(32),
    fetchImpl:async () => new Response(JSON.stringify({
      url:"https://fraud.example/checkout",
    }),{status:200}),
  })).rejects.toThrow(/invalid hosted URL/);
});
