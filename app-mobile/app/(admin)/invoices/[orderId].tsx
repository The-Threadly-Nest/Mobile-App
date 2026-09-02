import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { ArrowLeft, Share2, FileText, Image as ImageIcon, X } from "lucide-react-native";
import ViewShot from "react-native-view-shot";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { useAppAlert } from "@/shared/hooks/useAppAlert";

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  atelierName: string;
  date: string;
  customerName: string;
  orderNumber: string;
  status: "Pending" | "Paid";
  items: Array<{ name: string; amount: number }>;
  total: number;
}

const INVOICE_DATABASE: Record<string, InvoiceDetail> = {
  "inv-1": {
    id: "inv-1",
    invoiceNumber: "INV-1042",
    atelierName: "Adaeze Couture",
    date: "Sep 6, 2026",
    customerName: "Chiamaka O.",
    orderNumber: "#TFH-2291",
    status: "Pending",
    items: [
      { name: "Bridal Aso-Ebi (2 pieces)", amount: 816000 },
      { name: "Beadwork & finishing", amount: 200000 },
    ],
    total: 1016000,
  },
  "inv-2": {
    id: "inv-2",
    invoiceNumber: "INV-1041",
    atelierName: "Adaeze Couture",
    date: "Aug 30, 2026",
    customerName: "Blessing A.",
    orderNumber: "#TFH-2285",
    status: "Paid",
    items: [
      { name: "Custom Velvet Agbada Set", amount: 320000 },
      { name: "Gold Thread Monogramming", amount: 58000 },
    ],
    total: 378000,
  },
  "inv-3": {
    id: "inv-3",
    invoiceNumber: "INV-1040",
    atelierName: "Adaeze Couture",
    date: "Jul 14, 2026",
    customerName: "Ifeoma N.",
    orderNumber: "#TFH-2270",
    status: "Paid",
    items: [
      { name: "Silk Corset Evening Gown", amount: 310000 },
      { name: "Express Bespoke Fitting", amount: 68000 },
    ],
    total: 378000,
  },
};

export default function InvoiceDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { showAlert } = useAppAlert();
  const viewShotRef = useRef<ViewShot>(null);

  const initialInvoice =
    (orderId && INVOICE_DATABASE[orderId]) ||
    Object.values(INVOICE_DATABASE).find(
      (inv) => inv.id === orderId || inv.invoiceNumber === orderId
    ) ||
    INVOICE_DATABASE["inv-1"];

  const [invoice, setInvoice] = useState<InvoiceDetail>(initialInvoice);
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);

  useEffect(() => {
    if (orderId) {
      const found =
        INVOICE_DATABASE[orderId] ||
        Object.values(INVOICE_DATABASE).find(
          (inv) => inv.id === orderId || inv.invoiceNumber === orderId
        );
      if (found) {
        setInvoice(found);
      }
    }
  }, [orderId]);

  const isPaid = invoice.status === "Paid";

  const handleMarkAsPaid = () => {
    setInvoice((prev) => ({ ...prev, status: "Paid" }));
    showAlert("Payment Updated", `Invoice ${invoice.invoiceNumber} has been marked as Paid.`);
  };

  const generatePDFUri = async () => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;700&family=Work+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
        <style>
          @page {
            size: A4 portrait;
            margin: 0;
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body {
            height: 100%;
            background-color: #FBF7EF;
            font-family: 'Work Sans', sans-serif;
            color: #1A1110;
          }
          .page-container {
            min-height: 100vh;
            padding: 36px 32px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .card {
            background-color: #FFFFFF;
            border-radius: 28px;
            padding: 40px 36px;
            border: 1px solid rgba(74, 8, 12, 0.12);
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .atelier-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .atelier-name {
            font-family: 'Fraunces', serif;
            font-size: 28px;
            font-weight: 700;
            color: #4A080C;
            margin-bottom: 6px;
          }
          .invoice-subtitle {
            font-size: 15px;
            color: #7A7265;
          }
          .status-pill {
            padding: 6px 18px;
            border-radius: 14px;
            font-size: 14px;
            font-weight: 600;
            background-color: ${isPaid ? '#D8EED7' : '#F4ECE1'};
            color: ${isPaid ? '#2E7D32' : '#B57E42'};
          }
          .dashed-line {
            border-top: 1.5px dashed #D5D8D2;
            margin: 28px 0;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
          }
          .field-label {
            font-size: 12px;
            font-weight: 600;
            color: #8A8275;
            letter-spacing: 0.8px;
            margin-bottom: 8px;
            text-transform: uppercase;
          }
          .field-value {
            font-size: 19px;
            font-weight: 600;
            color: #4A080C;
          }
          .items-section {
            flex: 1;
            margin-top: 10px;
          }
          .table-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 18px;
          }
          .item-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 0;
            border-bottom: 1px solid #F4F0E8;
          }
          .item-name {
            font-size: 17px;
            color: #1A1110;
          }
          .item-price {
            font-size: 17px;
            font-weight: 600;
            color: #1A1110;
          }
          .table-bottom-border {
            border-bottom: 0.5px solid #4A080C;
            margin-top: 16px;
            margin-bottom: 24px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
          }
          .total-label {
            font-family: 'Fraunces', serif;
            font-size: 24px;
            font-weight: 700;
            color: #4A080C;
          }
          .total-amount {
            font-family: 'Fraunces', serif;
            font-size: 24px;
            font-weight: 700;
            color: #4A080C;
          }
          .footer-note {
            text-align: center;
            margin-top: 24px;
            font-size: 13px;
            color: #7A7265;
            line-height: 1.5;
          }
        </style>
      </head>
      <body>
        <div class="page-container">
          <div class="card">
            <div>
              <div class="atelier-row">
                <div>
                  <div class="atelier-name">${invoice.atelierName}</div>
                  <div class="invoice-subtitle">${invoice.invoiceNumber}  •  ${invoice.date}</div>
                </div>
                <div class="status-pill">${invoice.status}</div>
              </div>

              <div class="dashed-line"></div>

              <div class="info-row">
                <div>
                  <div class="field-label">BILLED TO</div>
                  <div class="field-value">${invoice.customerName}</div>
                </div>
                <div style="text-align: right;">
                  <div class="field-label">ORDER</div>
                  <div class="field-value">${invoice.orderNumber}</div>
                </div>
              </div>

              <div class="dashed-line"></div>

              <div class="items-section">
                <div class="table-header">
                  <div class="field-label">ITEM</div>
                  <div class="field-label">TOTAL</div>
                </div>

                ${invoice.items
                  .map(
                    (item) => `
                  <div class="item-row">
                    <div class="item-name">${item.name}</div>
                    <div class="item-price">&#8358;${item.amount.toLocaleString()}</div>
                  </div>
                `
                  )
                  .join('')}
              </div>
            </div>

            <div>
              <div class="table-bottom-border"></div>

              <div class="total-row">
                <div class="total-label">Total</div>
                <div class="total-amount">&#8358;${invoice.total.toLocaleString()}</div>
              </div>

              <div class="footer-note">
                Thank you for choosing <strong>${invoice.atelierName}</strong>.<br/>
                Bespoke craftsmanship tailored to perfection.
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    const { uri } = await Print.printToFileAsync({ html: htmlContent });

    // Dynamic file name: e.g. Chiamaka O. - Invoice from Adaeze Couture.pdf
    const cleanCustomer = invoice.customerName.replace(/[/\\?%*:|"<>]/g, "");
    const cleanAtelier = invoice.atelierName.replace(/[/\\?%*:|"<>]/g, "");
    const customFileName = `${cleanCustomer} - Invoice from ${cleanAtelier}.pdf`;
    const targetUri = `${FileSystem.cacheDirectory}${customFileName}`;

    await FileSystem.copyAsync({
      from: uri,
      to: targetUri,
    });

    return targetUri;
  };

  // Dedicated Download PDF
  const handleDownloadPDF = async () => {
    try {
      setIsGenerating(true);
      const uri = await generatePDFUri();
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

      await FileSystem.copyAsync({
        from: uri,
        to: targetUri,
      });

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
            onPress={() => router.push("/(admin)/invoices" as any)}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <ArrowLeft size={18} color="#3B0508" />
          </Pressable>

          <Text style={styles.headerTitle}>Invoice</Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Capturable White Card Container */}
          <ViewShot ref={viewShotRef} options={{ format: "png", quality: 1.0 }}>
            <View style={styles.card}>
              {/* Atelier & Status Header */}
              <View style={styles.atelierRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.atelierName}>{invoice.atelierName}</Text>
                  <Text style={styles.invoiceSubtitle}>
                    {invoice.invoiceNumber}  •  {invoice.date}
                  </Text>
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
              <View style={styles.infoRow}>
                <View style={styles.infoCol}>
                  <Text style={styles.fieldLabel}>BILLED TO</Text>
                  <Text style={styles.fieldValue}>{invoice.customerName}</Text>
                </View>

                <View style={[styles.infoCol, { alignItems: "flex-end" }]}>
                  <Text style={styles.fieldLabel}>ORDER</Text>
                  <Text style={styles.fieldValue}>{invoice.orderNumber}</Text>
                </View>
              </View>

              {/* Dashed Separator */}
              <View style={styles.dashedLine} />

              {/* Line Items Table */}
              <View style={styles.itemsTable}>
                <View style={styles.tableHeaderRow}>
                  <Text style={styles.fieldLabel}>ITEM</Text>
                  <Text style={styles.fieldLabel}>TOTAL</Text>
                </View>

                {invoice.items.map((item, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemPrice}>₦{item.amount.toLocaleString()}</Text>
                  </View>
                ))}

                {/* Items Bottom Solid Underline */}
                <View style={styles.tableBottomBorder} />
              </View>

              {/* Grand Total Row */}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalAmount}>₦{invoice.total.toLocaleString()}</Text>
              </View>
            </View>
          </ViewShot>

          {/* Dual Action Buttons */}
          <View style={styles.actionButtonsRow}>
            {/* Download PDF Button (Dedicated) */}
            <Pressable
              onPress={handleDownloadPDF}
              disabled={isGenerating}
              style={({ pressed }) => [
                styles.primaryBtn,
                { opacity: pressed || isGenerating ? 0.85 : 1 },
              ]}
            >
              {isGenerating ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Download PDF</Text>
              )}
            </Pressable>

            {/* Mark as Paid OR Share Button */}
            {!isPaid ? (
              <Pressable
                onPress={handleMarkAsPaid}
                style={({ pressed }) => [
                  styles.outlineBtn,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.outlineBtnText}>Mark as Paid</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setShareModalVisible(true)}
                style={({ pressed }) => [
                  styles.outlineBtn,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Share2 size={16} color="#4A080C" />
                  <Text style={styles.outlineBtnText}>Share</Text>
                </View>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </View>

      {/* Share Chooser Modal */}
      <Modal
        visible={shareModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setShareModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShareModalVisible(false)}
        >
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share Invoice</Text>
              <Pressable onPress={() => setShareModalVisible(false)} hitSlop={8}>
                <X size={20} color="#7A7265" />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              Choose how you would like to share this invoice with the client:
            </Text>

            {/* Option 1: PDF */}
            <Pressable
              onPress={handleShareAsPDF}
              style={({ pressed }) => [
                styles.modalOption,
                { backgroundColor: pressed ? "#F5EFE6" : "#FFFFFF" },
              ]}
            >
              <View style={styles.optionIconContainer}>
                <FileText size={22} color="#4A080C" />
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
                { backgroundColor: pressed ? "#F5EFE6" : "#FFFFFF" },
              ]}
            >
              <View style={styles.optionIconContainer}>
                <ImageIcon size={22} color="#4A080C" />
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
    backgroundColor: "#FBF7EF",
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
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
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  headerTitle: {
    fontFamily: "Fraunces-Bold",
    fontSize: 24,
    lineHeight: 28,
    color: "#1A1110",
    letterSpacing: -0.2,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
    shadowColor: "#000",
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
    fontFamily: "Fraunces-Bold",
    fontSize: 18,
    color: "#4A080C",
    marginBottom: 4,
  },
  invoiceSubtitle: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "#7A7265",
  },
  dashedLine: {
    borderStyle: "dashed",
    borderWidth: 0.8,
    borderColor: "#E2E5DF",
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
    fontFamily: "WorkSans_500Medium",
    fontSize: 11,
    color: "#8A8275",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  fieldValue: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#4A080C",
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
    fontFamily: "WorkSans_400Regular",
    fontSize: 15,
    color: "#1A1110",
    flex: 1,
    paddingRight: 12,
  },
  itemPrice: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 15,
    color: "#1A1110",
  },
  tableBottomBorder: {
    borderBottomWidth: 0.5,
    borderColor: "#4A080C",
    marginTop: 6,
    marginBottom: 18,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontFamily: "Fraunces-Bold",
    fontSize: 18,
    color: "#4A080C",
  },
  totalAmount: {
    fontFamily: "Fraunces-Bold",
    fontSize: 18,
    color: "#4A080C",
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingPill: {
    backgroundColor: "#F4ECE1",
  },
  paidPill: {
    backgroundColor: "#D8EED7",
  },
  statusText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 12,
  },
  pendingText: {
    color: "#B57E42",
  },
  paidText: {
    color: "#2E7D32",
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 28,
  },
  primaryBtn: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 15,
    color: "#FFFFFF",
  },
  outlineBtn: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
  },
  outlineBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 15,
    color: "#4A080C",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(20, 5, 5, 0.55)",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
    shadowColor: "#000",
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
    fontFamily: "Fraunces-Bold",
    fontSize: 20,
    color: "#1A1110",
  },
  modalSubtitle: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    color: "#7A7265",
    marginBottom: 20,
    lineHeight: 20,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.12)",
    marginBottom: 12,
    gap: 14,
  },
  optionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(74, 8, 12, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  optionTitle: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 15,
    color: "#1A1110",
    marginBottom: 2,
  },
  optionDesc: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 12,
    color: "#7A7265",
  },
});
