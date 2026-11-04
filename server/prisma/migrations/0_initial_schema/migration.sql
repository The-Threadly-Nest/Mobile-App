-- Missing original schema, before the existing incremental migrations.
-- For a NEW empty database only. Existing db-push databases must be baselined
-- after schema review; never replay this against Neon or use a forced reset.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "googleId" TEXT,
    "passwordHash" TEXT,
    "name" TEXT,
    "role" TEXT NOT NULL,
    "fashionHouseId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "pushToken" TEXT,
    "resetTokenHash" TEXT,
    "resetTokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fashion_houses" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "location" TEXT,
    "phone" TEXT,
    "bio" TEXT,
    "brandLogoUrl" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "accountName" TEXT,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fashion_houses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "fashionHouseId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "sheetUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurements" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'in',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "fashionHouseId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "staffId" TEXT,
    "bookingId" TEXT,
    "itemName" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'order_placed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0.075,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
    "bankName" TEXT,
    "accountNumber" TEXT,
    "accountName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_items" (
    "id" TEXT NOT NULL,
    "fashionHouseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "sizes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "colors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priceFrom" INTEGER,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "available_slots" (
    "id" TEXT NOT NULL,
    "fashionHouseId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "booked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "available_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "fashionHouseId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "styleNotes" TEXT,
    "preferredDate" TIMESTAMP(3) NOT NULL,
    "preferredTime" TEXT NOT NULL,
    "isFirstTime" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'pending_admin_review',
    "availableSlotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_escalations" (
    "id" TEXT NOT NULL,
    "fashionHouseId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sketches" (
    "id" TEXT NOT NULL,
    "fashionHouseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sketches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "styles" TEXT[],
    "budget" TEXT NOT NULL,
    "timeline" TEXT NOT NULL,
    "phone" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mood_board_sketches" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "promotedToCatalog" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mood_board_sketches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "fashionHouseId" TEXT NOT NULL,
    "history" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direct_messages" (
    "id" TEXT NOT NULL,
    "clientMessageId" TEXT,
    "fashionHouseId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "audioUrl" TEXT,
    "audioDuration" INTEGER,
    "readAt" TIMESTAMP(3),
    "deletedForEveryoneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direct_message_thread_states" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fashionHouseId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "clearedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "direct_message_thread_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direct_message_user_deletions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direct_message_user_deletions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE INDEX "users_fashionHouseId_idx" ON "users"("fashionHouseId");

-- CreateIndex
CREATE INDEX "users_fashionHouseId_role_idx" ON "users"("fashionHouseId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "fashion_houses_adminId_key" ON "fashion_houses"("adminId");

-- CreateIndex
CREATE INDEX "fashion_houses_createdAt_idx" ON "fashion_houses"("createdAt");

-- CreateIndex
CREATE INDEX "customers_fashionHouseId_name_idx" ON "customers"("fashionHouseId", "name");

-- CreateIndex
CREATE INDEX "customers_userId_idx" ON "customers"("userId");

-- CreateIndex
CREATE INDEX "measurements_customerId_idx" ON "measurements"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_bookingId_key" ON "orders"("bookingId");

-- CreateIndex
CREATE INDEX "orders_fashionHouseId_idx" ON "orders"("fashionHouseId");

-- CreateIndex
CREATE INDEX "orders_fashionHouseId_createdAt_idx" ON "orders"("fashionHouseId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_staffId_idx" ON "orders"("staffId");

-- CreateIndex
CREATE INDEX "orders_fashionHouseId_status_createdAt_idx" ON "orders"("fashionHouseId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_orderId_key" ON "invoices"("orderId");

-- CreateIndex
CREATE INDEX "invoices_createdAt_idx" ON "invoices"("createdAt");

-- CreateIndex
CREATE INDEX "invoices_paymentStatus_createdAt_idx" ON "invoices"("paymentStatus", "createdAt");

-- CreateIndex
CREATE INDEX "catalog_items_fashionHouseId_createdAt_idx" ON "catalog_items"("fashionHouseId", "createdAt");

-- CreateIndex
CREATE INDEX "catalog_items_createdAt_idx" ON "catalog_items"("createdAt");

-- CreateIndex
CREATE INDEX "available_slots_fashionHouseId_booked_idx" ON "available_slots"("fashionHouseId", "booked");

-- CreateIndex
CREATE UNIQUE INDEX "available_slots_fashionHouseId_date_time_key" ON "available_slots"("fashionHouseId", "date", "time");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_availableSlotId_key" ON "bookings"("availableSlotId");

-- CreateIndex
CREATE INDEX "bookings_fashionHouseId_status_idx" ON "bookings"("fashionHouseId", "status");

-- CreateIndex
CREATE INDEX "bookings_customerId_preferredDate_idx" ON "bookings"("customerId", "preferredDate");

-- CreateIndex
CREATE INDEX "bookings_customerId_createdAt_idx" ON "bookings"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "chat_escalations_fashionHouseId_resolved_idx" ON "chat_escalations"("fashionHouseId", "resolved");

-- CreateIndex
CREATE INDEX "sketches_fashionHouseId_idx" ON "sketches"("fashionHouseId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_preferences_userId_key" ON "customer_preferences"("userId");

-- CreateIndex
CREATE INDEX "mood_board_sketches_staffId_idx" ON "mood_board_sketches"("staffId");

-- CreateIndex
CREATE INDEX "chat_sessions_customerId_idx" ON "chat_sessions"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_sessions_customerId_fashionHouseId_key" ON "chat_sessions"("customerId", "fashionHouseId");

-- CreateIndex
CREATE INDEX "direct_messages_fashionHouseId_customerId_createdAt_idx" ON "direct_messages"("fashionHouseId", "customerId", "createdAt");

-- CreateIndex
CREATE INDEX "direct_messages_customerId_createdAt_idx" ON "direct_messages"("customerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "direct_messages_senderId_clientMessageId_key" ON "direct_messages"("senderId", "clientMessageId");

-- CreateIndex
CREATE INDEX "direct_message_thread_states_fashionHouseId_customerId_idx" ON "direct_message_thread_states"("fashionHouseId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "direct_message_thread_states_userId_fashionHouseId_customer_key" ON "direct_message_thread_states"("userId", "fashionHouseId", "customerId");

-- CreateIndex
CREATE INDEX "direct_message_user_deletions_messageId_idx" ON "direct_message_user_deletions"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "direct_message_user_deletions_userId_messageId_key" ON "direct_message_user_deletions"("userId", "messageId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_fashionHouseId_fkey" FOREIGN KEY ("fashionHouseId") REFERENCES "fashion_houses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fashion_houses" ADD CONSTRAINT "fashion_houses_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_fashionHouseId_fkey" FOREIGN KEY ("fashionHouseId") REFERENCES "fashion_houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_fashionHouseId_fkey" FOREIGN KEY ("fashionHouseId") REFERENCES "fashion_houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_fashionHouseId_fkey" FOREIGN KEY ("fashionHouseId") REFERENCES "fashion_houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "available_slots" ADD CONSTRAINT "available_slots_fashionHouseId_fkey" FOREIGN KEY ("fashionHouseId") REFERENCES "fashion_houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_fashionHouseId_fkey" FOREIGN KEY ("fashionHouseId") REFERENCES "fashion_houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_availableSlotId_fkey" FOREIGN KEY ("availableSlotId") REFERENCES "available_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_escalations" ADD CONSTRAINT "chat_escalations_fashionHouseId_fkey" FOREIGN KEY ("fashionHouseId") REFERENCES "fashion_houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_escalations" ADD CONSTRAINT "chat_escalations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sketches" ADD CONSTRAINT "sketches_fashionHouseId_fkey" FOREIGN KEY ("fashionHouseId") REFERENCES "fashion_houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_preferences" ADD CONSTRAINT "customer_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mood_board_sketches" ADD CONSTRAINT "mood_board_sketches_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_fashionHouseId_fkey" FOREIGN KEY ("fashionHouseId") REFERENCES "fashion_houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_fashionHouseId_fkey" FOREIGN KEY ("fashionHouseId") REFERENCES "fashion_houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_message_thread_states" ADD CONSTRAINT "direct_message_thread_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_message_user_deletions" ADD CONSTRAINT "direct_message_user_deletions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_message_user_deletions" ADD CONSTRAINT "direct_message_user_deletions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "direct_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
