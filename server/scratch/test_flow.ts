import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET!;

async function main() {
  console.log("Starting test server...");
  const server = app.listen(0);
  const address = server.address() as any;
  const port = address.port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`Server listening on ${baseUrl}`);

  try {
    // 1. Get or create an admin user and their fashion house
    console.log("Checking DB users...");
    let admin = await prisma.user.findFirst({
      where: { role: "admin" },
      include: { fashionHouseOwned: true }
    });

    if (!admin) {
      console.log("No admin found, creating test admin...");
      const newUser = await prisma.user.create({
        data: {
          email: `test_admin_${Date.now()}@example.com`,
          passwordHash: "dummy",
          role: "admin",
          active: true
        }
      });
      await prisma.fashionHouse.create({
        data: {
          adminId: newUser.id,
          shopName: "Test Atelier"
        }
      });
      admin = await prisma.user.findFirst({
        where: { id: newUser.id },
        include: { fashionHouseOwned: true }
      });
    } else if (!admin.fashionHouseOwned) {
      console.log("Admin exists but has no fashion house, creating one...");
      await prisma.fashionHouse.create({
        data: {
          adminId: admin.id,
          shopName: "Test Atelier"
        }
      });
      admin = await prisma.user.findFirst({
        where: { id: admin.id },
        include: { fashionHouseOwned: true }
      });
    }

    const fhId = admin!.fashionHouseOwned!.id;
    console.log(`Admin ID: ${admin!.id}, Fashion House ID: ${fhId}`);

    // Create a customer user
    let customer = await prisma.user.findFirst({
      where: { role: "customer" }
    });
    if (!customer) {
      console.log("No customer found, creating test customer...");
      customer = await prisma.user.create({
        data: {
          email: `test_customer_${Date.now()}@example.com`,
          passwordHash: "dummy",
          role: "customer",
          active: true
        }
      });
    }
    console.log(`Customer ID: ${customer.id}`);

    // Generate JWT tokens
    const adminToken = jwt.sign({ sub: admin!.id, email: admin!.email, role: admin!.role }, JWT_SECRET, { expiresIn: "1h" });
    const customerToken = jwt.sign({ sub: customer.id, email: customer.email, role: customer.role }, JWT_SECRET, { expiresIn: "1h" });

    // Clear any existing slots for a clean slate
    await prisma.availableSlot.deleteMany({ where: { fashionHouseId: fhId } });
    console.log("Cleared existing slots.");

    // ---- TEST CRUD OPERATIONS ----
    console.log("\n--- Testing POST /api/slots ---");
    const createRes = await fetch(`${baseUrl}/api/slots`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`
      },
      body: JSON.stringify({ date: "2026-08-25", time: "14:00" })
    });
    console.log("POST /api/slots Status:", createRes.status);
    const createdSlot = await createRes.json();
    console.log("POST /api/slots Body:", createdSlot);
    if (createRes.status !== 201) throw new Error("Failed to create slot");

    // Attempt to create a duplicate slot
    console.log("Testing POST /api/slots (Duplicate check) -> Expecting 400");
    const dupRes = await fetch(`${baseUrl}/api/slots`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`
      },
      body: JSON.stringify({ date: "2026-08-25", time: "14:00" })
    });
    console.log("Duplicate POST Status:", dupRes.status);
    const dupBody = await dupRes.json();
    console.log("Duplicate POST Body:", dupBody);
    if (dupRes.status !== 400) throw new Error("Duplicate slot was not prevented!");

    // Create another slot
    await fetch(`${baseUrl}/api/slots`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`
      },
      body: JSON.stringify({ date: "2026-08-26", time: "10:30" })
    });

    console.log("\n--- Testing GET /api/slots ---");
    const getRes = await fetch(`${baseUrl}/api/slots`, {
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    console.log("GET /api/slots Status:", getRes.status);
    const slotsList = await getRes.json();
    console.log("GET /api/slots Body:", slotsList);
    if (slotsList.length !== 2) throw new Error(`Expected 2 slots, got ${slotsList.length}`);

    console.log("\n--- Testing PATCH /api/slots/:id ---");
    const patchRes = await fetch(`${baseUrl}/api/slots/${createdSlot.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`
      },
      body: JSON.stringify({ time: "15:00", booked: true })
    });
    console.log("PATCH /api/slots/:id Status:", patchRes.status);
    const patchedSlot = await patchRes.json();
    console.log("PATCH /api/slots/:id Body:", patchedSlot);
    if (patchedSlot.time !== "15:00" || patchedSlot.booked !== true) throw new Error("PATCH failed to update correctly");

    // ---- TEST GEMINI CHAT INTEGRATION ----
    console.log("\n--- Testing Gemini Chat Integration ---");
    
    // First, let's create a fresh unbooked slot for the chat assistant to see
    console.log("Creating unbooked slot: 2026-08-27 16:30...");
    await fetch(`${baseUrl}/api/slots`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`
      },
      body: JSON.stringify({ date: "2026-08-27", time: "16:30" })
    });

    console.log("Sending chat message asking for available slots...");
    const chatRes = await fetch(`${baseUrl}/api/chat/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        fashionHouseId: fhId,
        message: "Hi, what available fitting slots do you have?",
        history: []
      })
    });
    console.log("Chat Response Status:", chatRes.status);
    const chatBody = await chatRes.json();
    console.log("Chat Response Body:", chatBody);

    if (!chatBody.reply.includes("2026-08-27") && !chatBody.reply.includes("16:30")) {
      console.log("WARNING: The slot was not explicitly listed in the response text, but let's see if Gemini has it.");
    } else {
      console.log("SUCCESS: Gemini response correctly mentions our slot!");
    }

    console.log("\n--- Testing Gemini Booking Trigger ---");
    const bookChatRes = await fetch(`${baseUrl}/api/chat/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        fashionHouseId: fhId,
        message: "I want to book the slot on 2026-08-27 at 16:30. I'm looking for a custom traditional aso oke outfit.",
        history: [
          { role: "user", text: "Hi, what available fitting slots do you have?" },
          { role: "model", text: chatBody.reply }
        ]
      })
    });
    console.log("Booking Chat Response Status:", bookChatRes.status);
    const bookChatBody = await bookChatRes.json();
    console.log("Booking Chat Response Body:", bookChatBody);

    if (bookChatBody.type === "booking_created") {
      console.log("SUCCESS: Gemini successfully invoked the create_booking tool!");
      console.log("Created Booking Details:", bookChatBody.booking);
    } else {
      throw new Error(`Expected booking_created, got ${bookChatBody.type}`);
    }

    // Clean up created slot
    console.log("\n--- Testing DELETE /api/slots/:id ---");
    const delRes = await fetch(`${baseUrl}/api/slots/${createdSlot.id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    console.log("DELETE /api/slots/:id Status (Expected 204):", delRes.status);
    if (delRes.status !== 204) throw new Error("DELETE failed");

    console.log("\nAll tests passed successfully!");
  } catch (err) {
    console.error("Test failed with error:", err);
  } finally {
    server.close();
    await prisma.$disconnect();
    console.log("Test server stopped.");
  }
}

main();
