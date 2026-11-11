import { typeScale } from "@/shared/utils/typeScale";
import React, { useState, useEffect, useRef } from "react";
import { View, ScrollView, Pressable, Modal, StyleSheet, useWindowDimensions, ActivityIndicator, Image } from "react-native";
import { Text } from "@/shared/components/Typography";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Share2, FileText, Image as ImageIcon, X, Printer, Check } from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import ViewShot from "react-native-view-shot";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { useAppAlert } from "@/shared/hooks/useAppAlert";
import { useAuthStore } from "@/stores/useAuthStore";
import { useAppDataStore } from "@/stores/useAppDataStore";
import { invoicesApi } from "@/shared/utils/apiClient";
import { isPaymentPaid } from "@/shared/domain/statuses";
import { formatCurrency, formatShortDate } from "@/shared/utils/formatters";

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  atelierName: string;
  date: string;
  customerName: string;
  orderNumber: string;
  status: "Pending" | "Paid";
  items: Array<{ name: string; amount: number }>;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  currency: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatMoney = (amount: number, currency: string) => formatCurrency(amount, currency);

export default function InvoiceDetailScreen() {
  const {
    orderId,
    customerName: paramCustomerName,
    orderNumber: paramOrderNumber,
    garment: paramGarment,
    price: paramPrice,
    status: paramStatus,
    date: paramDate,
  } = useLocalSearchParams<{
    orderId: string;
    customerName?: string;
    orderNumber?: string;
    garment?: string;
    price?: string;
    status?: string;
    date?: string;
  }>();

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { showAlert } = useAppAlert();
  const viewShotRef = useRef<any>(null);

  const authShopName = useAuthStore((s) => s.shopName);
  const authShopLogo = useAuthStore((s) => s.shopLogo);
  const storeOrders = useAppDataStore((s) => s.orders);

  // Match from store if possible
  const matchedOrder = storeOrders.find((o: any) => o.id === orderId || o.orderNumber === orderId);

  const atelierName = authShopName || "Fashion House";
  const orderShopLogo =
    matchedOrder?.shopLogo ||
    matchedOrder?.fashionHouseLogo ||
    matchedOrder?.fashionHouse?.brandLogoUrl ||
    null;
  const [profileShopLogo, setProfileShopLogo] = useState<string | null>(null);
  const shopLogo = profileShopLogo || authShopLogo || orderShopLogo;
  const customerName = paramCustomerName || matchedOrder?.customer || "Customer";
  const orderNumber = paramOrderNumber || matchedOrder?.orderNumber || (orderId ? `#TFH-${orderId.slice(0, 8).toUpperCase()}` : "Order");
  const invoiceNumber = orderNumber.replace("#TFH-", "INV-").replace("#", "INV-");
  const numericPrice = paramPrice ? parseFloat(paramPrice) : (matchedOrder?.price || 0);
  const garmentName = paramGarment || matchedOrder?.item || "Bespoke Fitting & Tailoring";

  const buildInitialInvoice = (): InvoiceDetail => {
    return {
      id: orderId || "",
      invoiceNumber,
      atelierName,
      date: paramDate || formatShortDate(new Date()),
      customerName,
      orderNumber,
      status: "Pending",
      items: [
        { name: garmentName, amount: numericPrice },
      ],
      subtotal: numericPrice,
      taxRate: 0.075,
      taxAmount: 0,
      total: numericPrice,
      currency: "NGN",
      bankName: "",
      accountNumber: "",
      accountName: "",
    };
  };

  const [invoice, setInvoice] = useState<InvoiceDetail>(buildInitialInvoice());
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [invoiceLoaded, setInvoiceLoaded] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");

  useEffect(() => {
    let active = true;

    if (!orderId) {
      setInvoiceError("A valid order is required to create an invoice.");
      return;
    }

    setInvoiceLoaded(false);
    setInvoiceError("");
    void invoicesApi
      .generateForOrder(orderId)
      .then((savedInvoice) => {
        if (!active) return;
        const order = savedInvoice.order;
        const house = order.fashionHouse;
        setProfileShopLogo(house.brandLogoUrl || null);
        setInvoice({
          id: savedInvoice.id,
          invoiceNumber: `INV-${savedInvoice.id.slice(0, 8).toUpperCase()}`,
          atelierName: house.shopName,
          date: formatShortDate(savedInvoice.createdAt),
          customerName: order.customer.name,
          orderNumber: `#TFH-${order.id.slice(0, 8).toUpperCase()}`,
          status: isPaymentPaid(savedInvoice.paymentStatus) ? "Paid" : "Pending",
          items: [{ name: order.itemName, amount: savedInvoice.subtotal }],
          subtotal: savedInvoice.subtotal,
          taxRate: savedInvoice.taxRate,
          taxAmount: savedInvoice.taxAmount,
          total: savedInvoice.total,
          currency: savedInvoice.currency,
          bankName: savedInvoice.bankName,
          accountNumber: savedInvoice.accountNumber,
          accountName: savedInvoice.accountName,
        });
        setInvoiceLoaded(true);
      })
      .catch((err: any) => {
        if (active) setInvoiceError(err?.message || "The invoice could not be loaded.");
      });

    return () => {
      active = false;
    };
  }, [orderId]);

  const isPaid = isPaymentPaid(invoice.status);
  const canExport =
    invoiceLoaded && Boolean(invoice.bankName && invoice.accountNumber && invoice.accountName);

  const handleMarkAsPaid = async () => {
    showAlert(
      "Payment Confirmation Unavailable",
      "Payment cannot be marked as paid until an authorized, auditable payment workflow is configured."
    );
  };

  const getHTMLContent = () => {
    if (!canExport) {
      throw new Error("A verified server invoice with payment details is required before export.");
    }
    const subtotal = invoice.subtotal;
    const vat = invoice.taxAmount;
    const grandTotal = invoice.total;
    const initial = invoice.atelierName ? invoice.atelierName.charAt(0).toUpperCase() : "A";
    const safeAtelierName = escapeHtml(invoice.atelierName);
    const safeCustomerName = escapeHtml(invoice.customerName);
    const safeAccountName = escapeHtml(invoice.accountName);
    const safeBankName = escapeHtml(invoice.bankName);
    const htmlMoney = (amount: number) => escapeHtml(formatCurrency(amount, invoice.currency));

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 portrait; margin: 0; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body {
            height: 100%;
            background-color: #FFFDF9;
            font-family: 'Instrument Sans', sans-serif;
            color: #2B2B2B;
          }
          .page-container {
            min-height: 100vh;
            padding: 36px 32px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
          }
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-20deg);
            font-family: 'Instrument Sans', sans-serif;
            font-size: 38px;
            font-weight: 700;
            color: #453332;
            opacity: 0.04;
            text-align: center;
            pointer-events: none;
            line-height: 1.2;
          }
          .card {
            background-color: #FFFDF9;
            border-radius: 28px;
            padding: 36px 32px;
            border: 1px solid rgba(69, 51, 50, 0.12);
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
            z-index: 1;
          }
          .atelier-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .brand-left {
            display: flex;
            align-items: center;
            gap: 14px;
          }
          .logo-badge {
            width: 48px;
            height: 48px;
            border-radius: 24px;
            background-color: #453332;
            border: 1.5px solid #453332;
            color: #FFFDF9;
            font-family: 'Instrument Sans', sans-serif;
            font-size: 22px;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .atelier-name {
            font-family: 'Instrument Sans', sans-serif;
            font-size: 24px;
            font-weight: 700;
            color: #453332;
            margin-bottom: 2px;
          }
          .app-tag {
            font-size: 12px;
            font-weight: 500;
            color: #453332;
            letter-spacing: 0.4px;
          }
          .status-pill {
            padding: 6px 16px;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 600;
            background-color: ${isPaid ? 'rgba(69, 51, 50, 0.12)' : '#FFFDF9'};
            color: ${isPaid ? '#453332' : '#453332'};
          }
          .dashed-line {
            border-top: 1.5px dashed #FFFDF9;
            margin: 24px 0;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
          }
          .field-label {
            font-size: 11px;
            font-weight: 600;
            color: #2B2B2B;
            letter-spacing: 0.8px;
            margin-bottom: 6px;
            text-transform: uppercase;
          }
          .field-value {
            font-size: 17px;
            font-weight: 600;
            color: #453332;
          }
          .items-section {
            margin-top: 8px;
          }
          .table-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 14px;
          }
          .item-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid #FFFDF9;
          }
          .item-name { font-size: 15px; color: #2B2B2B; }
          .item-price { font-size: 15px; font-weight: 600; color: #2B2B2B; }
          .summary-row {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            color: #453332;
            margin-top: 14px;
            margin-bottom: 6px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            margin-top: 6px;
          }
          .total-label, .total-amount {
            font-family: 'Instrument Sans', sans-serif;
            font-size: 22px;
            font-weight: 700;
            color: #453332;
          }
          .payment-card {
            background-color: #FFFDF9;
            border: 1px solid rgba(69, 51, 50, 0.12);
            border-radius: 14px;
            padding: 16px;
            margin-top: 18px;
          }
          .payment-title {
            font-size: 11px;
            font-weight: 600;
            color: #453332;
            letter-spacing: 0.8px;
            margin-bottom: 10px;
            text-align: center;
          }
          .payment-grid {
            display: flex;
            justify-content: space-between;
            gap: 12px;
          }
          .payment-col-label { font-size: 10px; color: #453332; font-weight: 600; margin-bottom: 2px; }
          .payment-col-val { font-size: 13px; color: #453332; font-weight: 600; }
          .footer-note {
            text-align: center;
            margin-top: 20px;
            font-size: 12px;
            color: #2B2B2B;
            line-height: 1.5;
          }
        </style>
      </head>
      <body>
        <div class="page-container">
          <div class="watermark">OWUJA<br/>OFFICIAL INVOICE</div>
          <div class="card">
            <div>
              <div class="atelier-row">
                <div class="brand-left">
                  ${shopLogo
        ? `<img src="${shopLogo}" style="width: 48px; height: 48px; border-radius: 24px; border: 1.5px solid #453332; object-fit: cover;" />`
        : `<div class="logo-badge">${initial}</div>`
      }
                  <div>
                    <div class="atelier-name">${safeAtelierName}</div>
                    <div class="app-tag">Owuja • ${invoice.invoiceNumber}</div>
                  </div>
                </div>
                <div class="status-pill">${invoice.status}</div>
              </div>

              <div class="dashed-line"></div>

              <div class="info-row">
                <div>
                  <div class="field-label">BILLED TO</div>
                  <div class="field-value">${safeCustomerName}</div>
                </div>
                <div style="text-align: right;">
                  <div class="field-label">ORDER & DATE</div>
                  <div class="field-value">${invoice.orderNumber}</div>
                  <div style="font-size: 12px; color: #2B2B2B; margin-top: 2px;">${invoice.date}</div>
                </div>
              </div>

              <div class="dashed-line"></div>

              <div class="items-section">
                <div class="table-header">
                  <div class="field-label">ITEM</div>
                  <div class="field-label">AMOUNT</div>
                </div>

                ${invoice.items
        .map(
          (item) => `
                    <div class="item-row">
                      <div class="item-name">${escapeHtml(item.name)}</div>
                      <div class="item-price">${htmlMoney(item.amount)}</div>
                    </div>
                  `
        )
        .join('')}
              </div>

              <div class="summary-row">
                <div>Subtotal</div>
                <div style="font-weight: 600; color: #453332;">${htmlMoney(subtotal)}</div>
              </div>
              <div class="summary-row">
                <div>VAT / Tax (${(invoice.taxRate * 100).toLocaleString()}%)</div>
                <div style="font-weight: 600; color: #453332;">${htmlMoney(vat)}</div>
              </div>

              <div class="total-row">
                <div class="total-label">Total Due</div>
                <div class="total-amount">${htmlMoney(grandTotal)}</div>
              </div>
            </div>

            <div>
              <div class="payment-card">
                <div class="payment-title">PAYMENT INFORMATION</div>
                <div class="payment-grid">
                  <div>
                    <div class="payment-col-label">BANK</div>
                    <div class="payment-col-val">${safeBankName}</div>
                  </div>
                  <div>
                    <div class="payment-col-label">ACCOUNT NO.</div>
                    <div class="payment-col-val">${invoice.accountNumber}</div>
                  </div>
                  <div>
                    <div class="payment-col-label">BENEFICIARY</div>
                    <div class="payment-col-val">${safeAccountName}</div>
                  </div>
                </div>
              </div>

              <div class="footer-note">
                <strong>Owuja</strong>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const generatePDFUri = async () => {
    const htmlContent = getHTMLContent();
    const { uri } = await Print.printToFileAsync({ html: htmlContent });

    // Dynamic file name: e.g. Chiamaka O. - Invoice from Adaeze Couture.pdf
    const cleanCustomer = invoice.customerName.replace(/[/\\?%*:|"<>]/g, "");
    const cleanAtelier = invoice.atelierName.replace(/[/\\?%*:|"<>]/g, "");
    const customFileName = `${cleanCustomer} - Invoice from ${cleanAtelier}.pdf`;
    const targetUri = `${FileSystem.cacheDirectory}${customFileName}`;

    await FileSystem.deleteAsync(targetUri, { idempotent: true });
    await FileSystem.copyAsync({
      from: uri,
      to: targetUri,
    });

    return targetUri;
  };

  // Direct Print via AirPrint / Wireless printer
  const handlePrint = async () => {
    try {
      setIsGenerating(true);
      const htmlContent = getHTMLContent();
      await Print.printAsync({ html: htmlContent });
    } catch (e: any) {
      showAlert("Print Error", e.message || "Failed to send invoice to printer");
    } finally {
      setIsGenerating(false);
    }
  };

  // Dedicated Download PDF
  const handleDownloadPDF = async () => {
    try {
      setIsGenerating(true);
      const uri = await generatePDFUri();
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        showAlert("Notice", "Sharing is not supported on this device/environment.");
        return;
      }
      await Sharing.shareAsync(uri, {
        UTI: ".pdf",
        mimeType: "application/pdf",
        dialogTitle: `${invoice.customerName} - Invoice from ${invoice.atelierName}`,
      });
    } catch (e: any) {
      showAlert("Download Error", e.message || "Failed to generate PDF");
    } finally {
      setIsGenerating(false);
    }
  };

  // Share as PDF from modal
  const handleShareAsPDF = async () => {
    setShareModalVisible(false);
    try {
      setIsGenerating(true);
      const uri = await generatePDFUri();
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        showAlert("Notice", "Sharing is not supported on this device/environment.");
        return;
      }
      await Sharing.shareAsync(uri, {
        UTI: ".pdf",
        mimeType: "application/pdf",
        dialogTitle: `${invoice.customerName} - Invoice from ${invoice.atelierName}`,
      });
    } catch (e: any) {
      showAlert("Share Error", e.message || "Failed to share PDF");
    } finally {
      setIsGenerating(false);
    }
  };

  // Share as Image from modal
  const handleShareAsImage = async () => {
    setShareModalVisible(false);
    try {
      if (!viewShotRef.current?.capture) return;
      setIsGenerating(true);
      const uri = await viewShotRef.current.capture();

      const cleanCustomer = invoice.customerName.replace(/[/\\?%*:|"<>]/g, "");
      const cleanAtelier = invoice.atelierName.replace(/[/\\?%*:|"<>]/g, "");
      const customFileName = `${cleanCustomer} - Invoice from ${cleanAtelier}.png`;
      const targetUri = `${FileSystem.cacheDirectory}${customFileName}`;

      await FileSystem.deleteAsync(targetUri, { idempotent: true });
      await FileSystem.copyAsync({
        from: uri,
        to: targetUri,
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        showAlert("Notice", "Sharing is not supported on this device/environment.");
        return;
      }

      await Sharing.shareAsync(targetUri, {
        UTI: ".png",
        mimeType: "image/png",
        dialogTitle: `${invoice.customerName} - Invoice from ${invoice.atelierName}`,
      });
    } catch (e: any) {
      showAlert("Share Error", e.message || "Failed to capture invoice image");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={[styles.container, isLandscape && styles.containerLandscape]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.push("/(admin)/orders" as any);
              }
            }}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 , width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: 0, }]}
          >
            <BackArrowIcon size={24} color="#453332" />
          </Pressable>

          <Text style={styles.headerTitle}>Invoice</Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {!invoiceLoaded && !invoiceError ? (
            <ActivityIndicator color="#453332" style={{ marginBottom: 16 }} />
          ) : null}
          {invoiceError ? (
            <View style={{ backgroundColor: "#F9E8D3", borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <Text style={{ fontFamily: "InstrumentSans-Medium", color: "#F96951", textAlign: "center" }}>
                {invoiceError}
              </Text>
            </View>
          ) : null}
          {/* Capturable White Card Container */}
          <ViewShot ref={viewShotRef} options={{ format: "png", quality: 1.0 }}>
            <View style={styles.card}>
              {/* Background Watermark */}
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: 0, left: 0, right: 0, bottom: 0,
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 0,
                  opacity: 0.04,
                }}
              >
                <Text
                  style={{
                    fontFamily: "InstrumentSans-Regular",
                    fontSize: 26,
                    color: "#4A403B",
                    transform: [{ rotate: "-20deg" }],
                    textAlign: "center",
                  }}
                >
                  OWUJA{"\n"}OFFICIAL INVOICE
                </Text>
              </View>

              {/* Atelier Logo & Status Header */}
              <View style={[styles.atelierRow, { zIndex: 1 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                  {shopLogo ? (
                    <Image
                      source={{ uri: shopLogo }}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        borderWidth: 1.5,
                        borderColor: "#453332",
                      }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: "#453332",
                        borderWidth: 1.5,
                        borderColor: "#453332",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontFamily: "InstrumentSans-Regular", fontSize: 20, color: "#FFFDF9" }}>
                        {invoice.atelierName ? invoice.atelierName.charAt(0).toUpperCase() : "A"}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.atelierName}>{invoice.atelierName}</Text>
                    <Text style={styles.invoiceSubtitle}>
                      Owuja • {invoice.invoiceNumber}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.statusPill,
                    isPaid ? styles.paidPill : styles.pendingPill,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      isPaid ? styles.paidText : styles.pendingText,
                    ]}
                  >
                    {invoice.status}
                  </Text>
                </View>
              </View>

              {/* Dashed Separator */}
              <View style={styles.dashedLine} />

              {/* Billed To & Order Row */}
              <View style={[styles.infoRow, { zIndex: 1 }]}>
                <View style={styles.infoCol}>
                  <Text style={styles.fieldLabel}>BILLED TO</Text>
                  <Text style={styles.fieldValue}>{invoice.customerName}</Text>
                </View>

                <View style={[styles.infoCol, { alignItems: "flex-end" }]}>
                  <Text style={styles.fieldLabel}>ORDER & DATE</Text>
                  <Text style={styles.fieldValue}>{invoice.orderNumber}</Text>
                  <Text style={{ fontFamily: "InstrumentSans-Regular", fontSize: 12, color: "#4A403B", marginTop: 2 }}>
                    {invoice.date}
                  </Text>
                </View>
              </View>

              {/* Dashed Separator */}
              <View style={styles.dashedLine} />

              {/* Line Items Table */}
              <View style={[styles.itemsTable, { zIndex: 1 }]}>
                <View style={styles.tableHeaderRow}>
                  <Text style={styles.fieldLabel}>ITEM</Text>
                  <Text style={styles.fieldLabel}>TOTAL</Text>
                </View>

                {invoice.items.map((item, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemPrice}>{formatMoney(item.amount, invoice.currency)}</Text>
                  </View>
                ))}
              </View>

              {/* Tax & Breakdown Calculation Row */}
              <View style={{ marginTop: 14, marginBottom: 12, zIndex: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ fontFamily: "InstrumentSans-Regular", fontSize: 14, color: "#4A403B" }}>Subtotal</Text>
                  <Text style={{ fontFamily: "InstrumentSans-Medium", fontSize: 14, color: "#4A403B" }}>{formatMoney(invoice.subtotal, invoice.currency)}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ fontFamily: "InstrumentSans-Regular", fontSize: 14, color: "#4A403B" }}>VAT / Tax ({(invoice.taxRate * 100).toLocaleString()}%)</Text>
                  <Text style={{ fontFamily: "InstrumentSans-Medium", fontSize: 14, color: "#4A403B" }}>{formatMoney(invoice.taxAmount, invoice.currency)}</Text>
                </View>
              </View>

              {/* Grand Total Row */}
              <View style={[styles.totalRow, { zIndex: 1 }]}>
                <Text style={styles.totalLabel}>Total Due</Text>
                <Text style={styles.totalAmount}>{formatMoney(invoice.total, invoice.currency)}</Text>
              </View>

              {/* Payment Information Card Box */}
              <View
                style={{
                  marginTop: 18,
                  padding: 14,
                  backgroundColor: "#F9E8D3",
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: "rgba(69, 51, 50, 0.12)",
                  zIndex: 1,
                }}
              >
                <Text
                  style={{
                    fontFamily: "InstrumentSans-SemiBold",
                    fontSize: 11,
                    color: "#4A403B",
                    letterSpacing: 0.8,
                    marginBottom: 8,
                    textAlign: "center",
                  }}
                >
                  PAYMENT INFORMATION
                </Text>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                  <View>
                    <Text style={{ fontFamily: "InstrumentSans-Medium", fontSize: 10, color: "#4A403B", marginBottom: 2 }}>BANK</Text>
                    <Text style={{ fontFamily: "InstrumentSans-SemiBold", fontSize: 13, color: "#4A403B" }}>{invoice.bankName || "Not configured"}</Text>
                  </View>
                  <View>
                    <Text style={{ fontFamily: "InstrumentSans-Medium", fontSize: 10, color: "#4A403B", marginBottom: 2 }}>ACCOUNT NO.</Text>
                    <Text style={{ fontFamily: "InstrumentSans-SemiBold", fontSize: 13, color: "#4A403B" }}>{invoice.accountNumber || "—"}</Text>
                  </View>
                  <View>
                    <Text style={{ fontFamily: "InstrumentSans-Medium", fontSize: 10, color: "#4A403B", marginBottom: 2 }}>BENEFICIARY</Text>
                    <Text style={{ fontFamily: "InstrumentSans-SemiBold", fontSize: 13, color: "#4A403B" }}>{invoice.accountName || "—"}</Text>
                  </View>
                </View>
              </View>

              {/* Footer Tag */}
              <View style={{ marginTop: 16, alignItems: "center", zIndex: 1 }}>
                <Text style={{ fontFamily: "InstrumentSans-SemiBold", fontSize: 11, color: "#4A403B", textAlign: "center" }}>
                  Owuja
                </Text>
              </View>
            </View>
          </ViewShot>

          {/* Action Pills Row: Share & Mark as Paid */}
          <View style={styles.actionButtonsContainer}>
            <View style={styles.actionButtonsRow}>
              {/* Share Pill */}
              <Pressable
                onPress={() => setShareModalVisible(true)}
                disabled={isGenerating || !canExport}
                style={({ pressed }) => [
                  styles.outlineBtn,
                  { opacity: pressed || isGenerating ? 0.85 : !canExport ? 0.45 : 1 },
                ]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Share2 size={18} color="#453332" />
                  <Text style={styles.outlineBtnText}>Share</Text>
                </View>
              </Pressable>

              {/* Mark as Paid Pill */}
              <Pressable
                onPress={handleMarkAsPaid}
                disabled={isPaid}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { opacity: pressed ? 0.75 : isPaid ? 0.5 : 1 },
                ]}
              >
                <Text style={styles.primaryBtnText}>{isPaid ? "Paid" : "Payment Pending"}</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Share Modal */}
      <Modal
        visible={shareModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setShareModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShareModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share Invoice</Text>
              <Pressable onPress={() => setShareModalVisible(false)}>
                <X size={20} color="#2B2B2B" />
              </Pressable>
            </View>
            <Text style={styles.modalSubtitle}>Choose how you'd like to share this invoice.</Text>

            {/* Option 1: PDF */}
            <Pressable
              onPress={handleShareAsPDF}
              style={({ pressed }) => [
                styles.modalOption,
                { backgroundColor: pressed ? "#FFFFFF" : "#FFFFFF" },
              ]}
            >
              <View style={styles.optionIconContainer}>
                <FileText size={22} color="#453332" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>Share as PDF</Text>
                <Text style={styles.optionDesc}>Official printable document format</Text>
              </View>
            </Pressable>

            {/* Option 2: Image */}
            <Pressable
              onPress={handleShareAsImage}
              style={({ pressed }) => [
                styles.modalOption,
                { backgroundColor: pressed ? "#FFFFFF" : "#FFFFFF" },
              ]}
            >
              <View style={styles.optionIconContainer}>
                <ImageIcon size={22} color="#453332" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>Share as Image</Text>
                <Text style={styles.optionDesc}>High-resolution PNG for WhatsApp & chat</Text>
              </View>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 36,
  },
  containerLandscape: {
    maxWidth: 680,
    alignSelf: "center",
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  gap: 8, },
  backBtn: {
    width: 44,
    height: 44,



    alignItems: "center",
    justifyContent: "center",
    marginRight: 0,
  },
  headerTitle: {
    ...typeScale.pageTitle,
    color: "#4A403B",
    letterSpacing: -0.2,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "#F9E8D3",
    borderRadius: 28,
    padding: 24,
    shadowColor: "#2B2B2B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  atelierRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  atelierName: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 18,
    color: "#4A403B",
    marginBottom: 4,
  },
  invoiceSubtitle: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 13,
    color: "#4A403B",
  },
  dashedLine: {
    borderStyle: "dashed",
    borderWidth: 0.8,
    borderColor: "#453332",
    marginVertical: 18,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  infoCol: {
    flex: 1,
  },
  fieldLabel: {
    ...typeScale.label,
    color: "#4A403B",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  fieldValue: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 16,
    color: "#4A403B",
  },
  itemsTable: {
    marginTop: 4,
  },
  tableHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  itemName: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 15,
    color: "#4A403B",
    flex: 1,
    paddingRight: 12,
  },
  itemPrice: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 15,
    color: "#4A403B",
  },
  tableBottomBorder: {
    borderBottomWidth: 0,
    borderColor: "#453332",
    marginTop: 6,
    marginBottom: 18,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 18,
    color: "#4A403B",
  },
  totalAmount: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 18,
    color: "#4A403B",
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingPill: {
    backgroundColor: "#FFFFFF",
  },
  paidPill: {
    backgroundColor: "rgba(69, 51, 50, 0.12)",
  },
  statusText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 12,
  },
  pendingText: {
    color: "#453332",
  },
  paidText: {
    color: "#4A403B",
  },
  actionButtonsContainer: {
    marginTop: 28,
    gap: 12,
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  primaryBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#F96951",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    ...typeScale.button,
    color: "#FFFDF9",
  },
  outlineBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#F96951",
    alignItems: "center",
    justifyContent: "center",
  },
  outlineBtnText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 15,
    color: "#4A403B",
  },
  secondaryBtn: {
    width: "100%",
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(69, 51, 50, 0.12)",
  },
  secondaryBtnText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 15,
    color: "#4A403B",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(43, 43, 43, 0.55)",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  modalCard: {
    backgroundColor: "#F9E8D3",
    borderRadius: 28,
    padding: 24,
    shadowColor: "#2B2B2B",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalTitle: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 20,
    color: "#4A403B",
  },
  modalSubtitle: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 14,
    color: "#4A403B",
    marginBottom: 20,
    lineHeight: 20,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(69, 51, 50, 0.12)",
    marginBottom: 12,
    gap: 14,
  },
  optionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(69, 51, 50, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  optionTitle: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 15,
    color: "#4A403B",
    marginBottom: 2,
  },
  optionDesc: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 12,
    color: "#4A403B",
  },
});
