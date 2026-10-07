import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  UserRole,
} from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  // Clean existing demo data
  await prisma.adminDecision.deleteMany();
  await prisma.requestEvent.deleteMany();
  await prisma.policyAssessment.deleteMany();
  await prisma.moveRequest.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.user.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.communityPolicy.deleteMany();
  await prisma.community.deleteMany();

  // ---------------------------------------------------------------------------
  // Skyline Heights
  // ---------------------------------------------------------------------------

  const skyline = await prisma.community.create({
    data: {
      name: "Skyline Heights",
      code: "SKYLINE",
    },
  });

  const skylineUnit = await prisma.unit.create({
    data: {
      communityId: skyline.id,
      number: "A-101",
      tower: "Tower A",
    },
  });

  await prisma.communityPolicy.create({
    data: {
      communityId: skyline.id,
      version: 1,
      active: true,
      config: {
        noticeHours: 48,
        movingHours: {
          start: "09:00",
          end: "18:00",
        },
        elevatorBookingRequired: true,
        requiredDocuments: {
          MOVE_IN: ["IDENTITY_PROOF"],
          MOVE_OUT: [
            "IDENTITY_PROOF",
            "MOVE_OUT_CLEARANCE",
          ],
        },
        maxMovesPerSlot: 2,
        adminApprovalRequired: true,
      },
    },
  });

  await prisma.user.create({
    data: {
      communityId: skyline.id,
      unitId: skylineUnit.id,
      name: "Resident",
      email: "demo@demo.com",
      role: UserRole.RESIDENT,
    },
  });

  await prisma.user.create({
    data: {
      communityId: skyline.id,
      name: "Admin",
      email: "admin@admin.com",
      role: UserRole.ADMIN,
    },
  });

  // ---------------------------------------------------------------------------
  // Green Meadows
  // ---------------------------------------------------------------------------

  const greenMeadows = await prisma.community.create({
    data: {
      name: "Green Meadows",
      code: "GREEN_MEADOWS",
    },
  });

  const greenMeadowsUnit = await prisma.unit.create({
    data: {
      communityId: greenMeadows.id,
      number: "B-204",
      tower: "Tower B",
    },
  });

  await prisma.communityPolicy.create({
    data: {
      communityId: greenMeadows.id,
      version: 1,
      active: true,
      config: {
        noticeHours: 24,
        movingHours: {
          start: "08:00",
          end: "20:00",
        },
        elevatorBookingRequired: false,
        requiredDocuments: {
          MOVE_IN: ["IDENTITY_PROOF"],
          MOVE_OUT: ["IDENTITY_PROOF"],
        },
        maxMovesPerSlot: 4,
        adminApprovalRequired: true,
      },
    },
  });

  await prisma.user.create({
    data: {
      communityId: greenMeadows.id,
      unitId: greenMeadowsUnit.id,
      name: "Arjun Rao",
      email: "arjun@demo.local",
      role: UserRole.RESIDENT,
    },
  });

  await prisma.user.create({
    data: {
      communityId: greenMeadows.id,
      name: "Neha Sharma",
      email: "neha@demo.local",
      role: UserRole.ADMIN,
    },
  });

  console.log("Seed completed successfully.");
  console.log("");
  console.log("Demo users:");
  console.log("Resident: demo@demo.com");
  console.log("Admin:    admin@admin.com");
  console.log("Resident: arjun@demo.local");
  console.log("Admin:    neha@demo.local");
}

main()
  .catch((error) => {
    console.error("Seed failed:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
