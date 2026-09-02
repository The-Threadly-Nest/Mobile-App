import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  FlatList,
} from "react-native";
import { ChevronDown, Search, X } from "lucide-react-native";

export interface Country {
  name: string;
  code: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  { name: "Nigeria", code: "+234", flag: "🇳🇬" },
  { name: "United Kingdom", code: "+44", flag: "🇬🇧" },
  { name: "United States", code: "+1", flag: "🇺🇸" },
  { name: "Canada", code: "+1", flag: "🇨🇦" },
  { name: "Ghana", code: "+233", flag: "🇬🇭" },
  { name: "Kenya", code: "+254", flag: "🇰🇪" },
  { name: "South Africa", code: "+27", flag: "🇿🇦" },
  { name: "United Arab Emirates", code: "+971", flag: "🇦🇪" },
];

interface PhoneInputProps {
  value: string;
  onChangePhone: (formattedPhone: string) => void;
  label?: string;
  placeholder?: string;
  errorText?: string;
}

export function PhoneInputWithCountry({
  value,
  onChangePhone,
  label = "Phone Number",
  placeholder = "801 234 5678",
  errorText,
}: PhoneInputProps) {
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [nationalNumber, setNationalNumber] = useState<string>("");
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Parse initial or prop value into Country Code & National Digits
  useEffect(() => {
    if (!value) {
      setNationalNumber("");
      return;
    }

    const trimmed = value.trim();
    const matchedCountry = COUNTRIES.find((c) => trimmed.startsWith(c.code));

    if (matchedCountry) {
      setSelectedCountry(matchedCountry);
      const digits = trimmed.slice(matchedCountry.code.length).replace(/[^\d]/g, "");
      setNationalNumber(digits);
    } else {
      // Strips leading + or non-digits
      const digits = trimmed.replace(/^0+/, "").replace(/[^\d]/g, "");
      setNationalNumber(digits);
    }
  }, [value]);

  const handleTextChange = (text: string) => {
    // Strip non-digits and leading zero if user types local 080... format
    let cleanDigits = text.replace(/[^\d]/g, "");
    if (cleanDigits.startsWith("0")) {
      cleanDigits = cleanDigits.replace(/^0+/, "");
    }
    setNationalNumber(cleanDigits);

    if (cleanDigits.length > 0) {
      onChangePhone(`${selectedCountry.code} ${cleanDigits}`);
    } else {
      onChangePhone("");
    }
  };

  const handleSelectCountry = (country: Country) => {
    setSelectedCountry(country);
    setModalVisible(false);
    if (nationalNumber) {
      onChangePhone(`${country.code} ${nationalNumber}`);
    }
  };

  const filteredCountries = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.includes(searchQuery)
  );

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={[styles.inputRow, errorText ? styles.inputRowError : null]}>
        {/* Country Code Picker Pill */}
        <Pressable
          onPress={() => setModalVisible(true)}
          style={({ pressed }) => [styles.countryBtn, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Text style={styles.flagText}>{selectedCountry.flag}</Text>
          <Text style={styles.codeText}>{selectedCountry.code}</Text>
          <ChevronDown size={14} color="#3B0508" style={{ marginLeft: 2 }} />
        </Pressable>

        <View style={styles.divider} />

        {/* Phone Input */}
        <TextInput
          disableFullscreenUI={true}
          style={styles.textInput}
          placeholder={placeholder}
          placeholderTextColor="#8A7550"
          keyboardType="phone-pad"
          value={nationalNumber}
          onChangeText={handleTextChange}
        />
      </View>

      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

      {/* Country Selection Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country Code</Text>
              <Pressable onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <X size={20} color="#3B0508" />
              </Pressable>
            </View>

            {/* Search Input */}
            <View style={styles.searchBox}>
              <Search size={16} color="#8A7550" style={{ marginRight: 8 }} />
              <TextInput
                disableFullscreenUI={true}
                style={styles.searchInput}
                placeholder="Search country or code..."
                placeholderTextColor="#8A7550"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* Country List */}
            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.name}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = item.code === selectedCountry.code && item.name === selectedCountry.name;
                return (
                  <Pressable
                    onPress={() => handleSelectCountry(item)}
                    style={({ pressed }) => [
                      styles.countryItem,
                      isSelected ? styles.countryItemSelected : null,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Text style={styles.itemFlag}>{item.flag}</Text>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemCode}>{item.code}</Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontFamily: "Fraunces-SemiBold",
    fontSize: 15,
    color: "#3B0508",
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.3)",
    borderRadius: 14,
    height: 56,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
  },
  inputRowError: {
    borderColor: "#D32F2F",
  },
  countryBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 8,
  },
  flagText: {
    fontSize: 20,
    marginRight: 6,
  },
  codeText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 15,
    color: "#3B0508",
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(74, 8, 12, 0.2)",
    marginHorizontal: 8,
  },
  textInput: {
    flex: 1,
    fontFamily: "WorkSans_400Regular",
    fontSize: 16,
    color: "#3B0508",
    height: "100%",
  },
  errorText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 12,
    color: "#D32F2F",
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FBF7EF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: "75%",
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: "Fraunces-Bold",
    fontSize: 20,
    color: "#3B0508",
  },
  closeBtn: {
    padding: 6,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.2)",
    paddingHorizontal: 12,
    height: 46,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    color: "#3B0508",
  },
  countryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  countryItemSelected: {
    backgroundColor: "#EBE0D3",
  },
  itemFlag: {
    fontSize: 22,
    marginRight: 12,
  },
  itemName: {
    flex: 1,
    fontFamily: "WorkSans_500Medium",
    fontSize: 15,
    color: "#3B0508",
  },
  itemCode: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 14,
    color: "#4A080C",
  },
});
