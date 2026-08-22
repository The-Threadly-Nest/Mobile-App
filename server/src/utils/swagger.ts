export const swaggerSpec = {
  openapi: "3.0.0",
  info: {
    title: "The Threadly Nest API Documentation",
    version: "1.0.0",
    description: "Interactive Swagger UI for testing The Threadly Nest API endpoints.",
  },
  servers: [
    {
      url: "https://tth-server.vercel.app",
      description: "Production Server",
    },
    {
      url: "http://localhost:4000",
      description: "Development Server",
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Paste your JWT token here to authorize requests (obtained from /api/auth/login or signup).",
      },
    },
  },
  security: [
    {
      BearerAuth: [],
    },
  ],
  paths: {
    "/api/auth/signup": {
      post: {
        summary: "Sign up a new Admin or Customer user",
        tags: ["Auth"],
        security: [], // Public endpoint
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password", "role", "name"],
                properties: {
                  email: { type: "string", format: "email", example: "admin@example.com" },
                  password: { type: "string", minLength: 8, example: "SecurePassword123!" },
                  role: { type: "string", enum: ["admin", "customer"], example: "admin" },
                  name: { type: "string", example: "My First Shop" },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Account registered successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: { type: "object" },
                    token: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/auth/login": {
      post: {
        summary: "Log in with email and password",
        tags: ["Auth"],
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email", example: "admin@example.com" },
                  password: { type: "string", example: "SecurePassword123!" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Successful login",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: { type: "object" },
                    token: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/orders": {
      get: {
        summary: "List all orders (tenant-scoped)",
        tags: ["Orders"],
        responses: {
          200: { description: "Array of orders belonging to your fashion house." },
        },
      },
      post: {
        summary: "Create a new order (tenant-scoped)",
        tags: ["Orders"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["customerId", "itemName", "price"],
                properties: {
                  customerId: { type: "string", format: "uuid", example: "12345678-abcd-1234-abcd-1234567890ab" },
                  itemName: { type: "string", example: "Custom Evening Gown" },
                  price: { type: "integer", description: "Price in cents/kobo", example: 15000 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Order created successfully." },
        },
      },
    },
    "/api/orders/{id}/status": {
      patch: {
        summary: "Update order status (tenant-scoped)",
        tags: ["Orders"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: {
                  status: {
                    type: "string",
                    enum: ["order_placed", "in_production", "ready", "delivered"],
                    example: "in_production",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Status updated successfully." },
        },
      },
    },
    "/api/measurements": {
      post: {
        summary: "Add a new customer measurement (tenant-scoped)",
        tags: ["Measurements"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["customerId", "field", "value"],
                properties: {
                  customerId: { type: "string", format: "uuid", example: "12345678-abcd-1234-abcd-1234567890ab" },
                  field: { type: "string", example: "Chest" },
                  value: { type: "number", example: 38.5 },
                  unit: { type: "string", default: "in", example: "in" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Measurement recorded." },
        },
      },
    },
    "/api/measurements/customer/{customerId}": {
      get: {
        summary: "List measurements for a specific customer (tenant-scoped)",
        tags: ["Measurements"],
        parameters: [
          {
            name: "customerId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: { description: "Array of measurement fields for this customer." },
        },
      },
    },
    "/api/invoices": {
      post: {
        summary: "Generate an invoice from an order (tenant-scoped)",
        tags: ["Invoices"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["orderId"],
                properties: {
                  orderId: { type: "string", format: "uuid", example: "12345678-abcd-1234-abcd-1234567890ab" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Invoice generated (price recalculated on server)." },
        },
      },
    },
    "/api/catalog": {
      get: {
        summary: "List all catalog designs (tenant-scoped)",
        tags: ["Catalog"],
        responses: {
          200: { description: "Array of design items." },
        },
      },
      post: {
        summary: "Create a design catalog item (Admin/Staff only)",
        tags: ["Catalog"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "priceFrom", "imageUrl"],
                properties: {
                  name: { type: "string", example: "Traditional Aso Oke Outfit" },
                  priceFrom: { type: "integer", example: 45000 },
                  imageUrl: { type: "string", format: "url", example: "https://example.com/aso-oke.jpg" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Catalog item added." },
        },
      },
    },
    "/api/catalog/{id}": {
      patch: {
        summary: "Update catalog item (Admin/Staff only)",
        tags: ["Catalog"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", example: "Aso Oke Luxe Edit" },
                  priceFrom: { type: "integer", example: 50000 },
                  imageUrl: { type: "string", format: "url" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Catalog item updated." },
        },
      },
    },
    "/api/slots": {
      get: {
        summary: "List all booking slots for your fashion house (Admin/Staff only)",
        tags: ["Slots"],
        responses: {
          200: { description: "Array of booking slots." },
        },
      },
      post: {
        summary: "Create a new booking slot (Admin/Staff only)",
        tags: ["Slots"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["date", "time"],
                properties: {
                  date: { type: "string", example: "2026-08-25" },
                  time: { type: "string", example: "14:00" },
                  booked: { type: "boolean", default: false },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Booking slot created successfully." },
        },
      },
    },
    "/api/slots/{id}": {
      patch: {
        summary: "Update an available slot (Admin/Staff only)",
        tags: ["Slots"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  date: { type: "string", example: "2026-08-25" },
                  time: { type: "string", example: "15:00" },
                  booked: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Booking slot updated." },
        },
      },
      delete: {
        summary: "Delete a booking slot (Admin/Staff only)",
        tags: ["Slots"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          204: { description: "Slot deleted." },
        },
      },
    },
  },
};
