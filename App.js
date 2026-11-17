import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView,
  TouchableOpacity, StyleSheet, Alert
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from './src/translations';
import { initialRides } from './src/data';

const APP_NAME = 'Covoiturage TN';
const STORAGE_KEY = 'covoiturage-tn:v1';

function sameName(a, b) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function paymentLabel(t, value) {
  if (value === 'Cash') return t.cash;
  if (value === 'Online') return t.online;
  return t.both;
}

function statusLabel(t, status) {
  if (status === 'Pending') return t.pending;
  if (status === 'Approved') return t.approved;
  return t.rejected;
}

function RideCard({ ride, t, rtl, isMine, onBook }) {
  const dir = rtl && styles.rtlText;
  const row = rtl && styles.rowReverse;
  const blocked = isMine || ride.seats <= 0;

  return (
    <View style={styles.rideCard}>
      <View style={[styles.rideTop, row]}>
        <View style={[styles.routeBox, row]}>
          <Text style={styles.city}>{ride.from}</Text>
          <Text style={styles.arrow}>{rtl ? '←' : '→'}</Text>
          <Text style={styles.city}>{ride.to}</Text>
        </View>
        <View style={[styles.priceBox, rtl && styles.priceBoxRtl]}>
          <Text style={styles.price}>{ride.price} DT</Text>
          <Text style={styles.muted}>{t.price}</Text>
        </View>
      </View>

      <View style={styles.line} />

      <View style={[styles.infoRow, row]}>
        <Text style={[styles.info, dir]}>🕒 {ride.time}</Text>
        <Text style={[styles.info, dir]}>📅 {ride.date}</Text>
      </View>
      <View style={[styles.infoRow, row]}>
        <Text style={[styles.info, dir]}>🚘 {ride.car}</Text>
        <Text style={[styles.info, dir]}>👤 {ride.driver}</Text>
      </View>

      <View style={[styles.seatRow, row]}>
        <View>
          <Text style={[styles.seatTitle, dir]}>{t.available}: {ride.seats}</Text>
          <Text style={[styles.muted, dir]}>{t.remaining}</Text>
        </View>
        <View style={styles.seatBadge}>
          <Text style={styles.seatBadgeText}>💺 {ride.seats}</Text>
        </View>
      </View>

      <View style={styles.paymentRow}>
        <Text style={[styles.muted, dir]}>{t.payment}: {paymentLabel(t, ride.payment)}</Text>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, blocked && styles.disabled]}
        disabled={blocked}
        onPress={() => onBook(ride)}
      >
        <Text style={styles.primaryButtonText}>{isMine ? t.yourRide : t.book}</Text>
      </TouchableOpacity>
    </View>
  );
}

function AppContent() {
  const [loaded, setLoaded] = useState(false);
  const [language, setLanguage] = useState('FR');
  const t = translations[language];
  const rtl = language === 'AR';
  const dir = rtl && styles.rtlText;
  const row = rtl && styles.rowReverse;

  const [tab, setTab] = useState('home');
  const [rides, setRides] = useState(initialRides);
  const [bookings, setBookings] = useState([]);
  const [profileName, setProfileName] = useState('');

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [filter, setFilter] = useState(false);

  const [newFrom, setNewFrom] = useState('');
  const [newTo, setNewTo] = useState('');
  const [newDate, setNewDate] = useState('20 Nov');
  const [newTime, setNewTime] = useState('09:00');
  const [newPrice, setNewPrice] = useState('15');
  const [newSeats, setNewSeats] = useState('3');
  const [newCar, setNewCar] = useState('');
  const [newPayment, setNewPayment] = useState('Cash');

  // Load saved data once, then save on every change.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (saved.language) setLanguage(saved.language);
        if (Array.isArray(saved.rides)) setRides(saved.rides);
        if (Array.isArray(saved.bookings)) setBookings(saved.bookings);
        if (typeof saved.profileName === 'string') setProfileName(saved.profileName);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ language, rides, bookings, profileName })
    ).catch(() => {});
  }, [loaded, language, rides, bookings, profileName]);

  const me = profileName.trim();
  const findRide = id => rides.find(r => r.id === id);
  const isMine = ride => me !== '' && sameName(ride.driver, me);

  const visibleRides = rides.filter(ride =>
    ride.seats > 0 &&
    (!filter ||
      (ride.from.toLowerCase().includes(from.trim().toLowerCase()) &&
       ride.to.toLowerCase().includes(to.trim().toLowerCase())))
  );

  const myRequests = me ? bookings.filter(b => sameName(b.passenger, me)) : [];
  const receivedRequests = bookings.filter(b => {
    const ride = findRide(b.rideId);
    return ride && isMine(ride);
  });

  function requestBooking(ride) {
    if (!me) {
      Alert.alert(APP_NAME, t.enterName);
      setTab('bookings');
      return;
    }
    if (isMine(ride)) {
      Alert.alert(APP_NAME, t.ownRide);
      return;
    }
    const alreadyRequested = bookings.some(
      b => b.rideId === ride.id && sameName(b.passenger, me) && b.status !== 'Rejected'
    );
    if (alreadyRequested) {
      Alert.alert(APP_NAME, t.alreadyRequested);
      return;
    }
    if (ride.seats <= 0) {
      Alert.alert(APP_NAME, t.noSeats);
      return;
    }

    setBookings(old => [
      ...old,
      {
        id: Date.now().toString(),
        rideId: ride.id,
        passenger: me,
        status: 'Pending',
        payment: ride.payment
      }
    ]);
    Alert.alert(APP_NAME, t.request);
  }

  function approveBooking(booking) {
    const ride = findRide(booking.rideId);
    if (!ride || ride.seats <= 0) {
      Alert.alert(APP_NAME, t.noSeats);
      return;
    }
    const seatsLeft = ride.seats - 1;

    setRides(old => old.map(r =>
      r.id === ride.id ? { ...r, seats: seatsLeft } : r
    ));

    // When the last seat goes, the other pending requests for that ride are refused.
    setBookings(old => old.map(b => {
      if (b.id === booking.id) return { ...b, status: 'Approved' };
      if (seatsLeft === 0 && b.rideId === ride.id && b.status === 'Pending') {
        return { ...b, status: 'Rejected' };
      }
      return b;
    }));

    Alert.alert(APP_NAME, t.approvedMsg);
  }

  function rejectBooking(booking) {
    setBookings(old => old.map(b =>
      b.id === booking.id ? { ...b, status: 'Rejected' } : b
    ));
  }

  function publishRide() {
    if (!me) {
      Alert.alert(APP_NAME, t.enterName);
      setTab('bookings');
      return;
    }
    if (!newFrom.trim() || !newTo.trim() || !newCar.trim()) {
      Alert.alert(APP_NAME, t.fillFields);
      return;
    }

    const price = Number(newPrice.replace(',', '.'));
    const seats = Number(newSeats);
    if (!Number.isFinite(price) || price <= 0 ||
        !Number.isInteger(seats) || seats <= 0 || seats > 8) {
      Alert.alert(APP_NAME, t.invalidNumbers);
      return;
    }

    setRides(old => [
      {
        id: Date.now(),
        from: newFrom.trim(),
        to: newTo.trim(),
        date: newDate.trim(),
        time: newTime.trim(),
        price,
        seats,
        driver: me,
        car: newCar.trim(),
        payment: newPayment
      },
      ...old
    ]);

    setNewFrom('');
    setNewTo('');
    setNewCar('');
    setNewPrice('15');
    setNewSeats('3');
    setTab('home');
    Alert.alert(APP_NAME, t.success);
  }

  function renderRoute(ride) {
    if (!ride) return '—';
    return rtl ? `${ride.from} ← ${ride.to}` : `${ride.from} → ${ride.to}`;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="light" backgroundColor="#075C45" />

      <View style={styles.header}>
        <View style={[styles.headerTop, row]}>
          <View>
            <Text style={[styles.logo, dir]}>Covoiturage <Text style={styles.logoTN}>TN</Text></Text>
            <Text style={[styles.headerSub, dir]}>🇹🇳 {t.welcome}</Text>
          </View>
          <View style={styles.langRow}>
            {['FR', 'AR', 'EN'].map(lang => (
              <TouchableOpacity
                key={lang}
                onPress={() => setLanguage(lang)}
                style={[styles.langButton, language === lang && styles.langActive]}
              >
                <Text style={[styles.langText, language === lang && styles.langTextActive]}>
                  {lang}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={[styles.heroTitle, dir]}>{t.title}</Text>
        <Text style={[styles.heroSub, dir]}>{t.subtitle}</Text>
      </View>

      <View style={[styles.nav, row]}>
        {[
          ['home', '⌂', t.home],
          ['publish', '+', t.publish],
          ['bookings', '▣', t.bookings]
        ].map(([key, icon, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.navItem, tab === key && styles.navSelected]}
            onPress={() => setTab(key)}
          >
            <Text style={[styles.navIcon, tab === key && styles.navTextSelected]}>{icon}</Text>
            <Text style={[styles.navText, tab === key && styles.navTextSelected]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 35 }}
        keyboardShouldPersistTaps="handled"
      >
        {tab === 'home' && (
          <>
            <View style={styles.searchCard}>
              <Text style={[styles.sectionTitle, dir]}>🔎 {t.search}</Text>

              <Text style={[styles.fieldLabel, dir]}>{t.from}</Text>
              <TextInput
                value={from}
                onChangeText={value => { setFrom(value); setFilter(false); }}
                placeholder="Tunis..."
                placeholderTextColor="#9BAAA2"
                style={[styles.input, dir]}
              />

              <Text style={[styles.fieldLabel, dir]}>{t.to}</Text>
              <TextInput
                value={to}
                onChangeText={value => { setTo(value); setFilter(false); }}
                placeholder="Sousse..."
                placeholderTextColor="#9BAAA2"
                style={[styles.input, dir]}
              />

              <TouchableOpacity style={styles.primaryButton} onPress={() => setFilter(true)}>
                <Text style={styles.primaryButtonText}>{t.search}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { setFrom(''); setTo(''); setFilter(false); }}
                style={styles.clearButton}
              >
                <Text style={styles.clearText}>{t.all}</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.sectionHeader, row]}>
              <Text style={[styles.sectionTitle, dir]}>{t.recent}</Text>
              <Text style={styles.count}>{visibleRides.length} {t.rides}</Text>
            </View>

            {visibleRides.length === 0 ? (
              <Text style={styles.empty}>{t.noRides}</Text>
            ) : (
              visibleRides.map(ride => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  t={t}
                  rtl={rtl}
                  isMine={isMine(ride)}
                  onBook={requestBooking}
                />
              ))
            )}
          </>
        )}

        {tab === 'publish' && (
          <View style={styles.formCard}>
            <Text style={[styles.sectionTitle, dir]}>＋ {t.publish}</Text>

            <Text style={[styles.fieldLabel, dir]}>{t.from}</Text>
            <TextInput value={newFrom} onChangeText={setNewFrom}
              placeholder="Ex: Tunis" placeholderTextColor="#9BAAA2" style={[styles.input, dir]} />

            <Text style={[styles.fieldLabel, dir]}>{t.to}</Text>
            <TextInput value={newTo} onChangeText={setNewTo}
              placeholder="Ex: Sousse" placeholderTextColor="#9BAAA2" style={[styles.input, dir]} />

            <Text style={[styles.fieldLabel, dir]}>{t.date}</Text>
            <TextInput value={newDate} onChangeText={setNewDate}
              placeholder="15 Nov" placeholderTextColor="#9BAAA2" style={[styles.input, dir]} />

            <Text style={[styles.fieldLabel, dir]}>{t.time}</Text>
            <TextInput value={newTime} onChangeText={setNewTime}
              placeholder="09:00" placeholderTextColor="#9BAAA2" style={[styles.input, dir]} />

            <Text style={[styles.fieldLabel, dir]}>{t.car}</Text>
            <TextInput value={newCar} onChangeText={setNewCar}
              placeholder="Ex: Peugeot 208" placeholderTextColor="#9BAAA2" style={[styles.input, dir]} />

            <Text style={[styles.fieldLabel, dir]}>{t.price} (DT)</Text>
            <TextInput value={newPrice} onChangeText={setNewPrice}
              keyboardType="decimal-pad" style={[styles.input, dir]} />

            <Text style={[styles.fieldLabel, dir]}>{t.seats}</Text>
            <TextInput value={newSeats} onChangeText={setNewSeats}
              keyboardType="number-pad" style={[styles.input, dir]} />

            <Text style={[styles.fieldLabel, dir]}>{t.choosePayment}</Text>
            <View style={[styles.choiceRow, row]}>
              {['Cash', 'Online', 'Both'].map(p => (
                <TouchableOpacity key={p}
                  onPress={() => setNewPayment(p)}
                  style={[styles.choice, newPayment === p && styles.choiceActive]}>
                  <Text style={[styles.choiceText, newPayment === p && styles.choiceTextActive]}>
                    {paymentLabel(t, p)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={publishRide}>
              <Text style={styles.primaryButtonText}>{t.create}</Text>
            </TouchableOpacity>
          </View>
        )}

        {tab === 'bookings' && (
          <>
            <View style={styles.formCard}>
              <Text style={[styles.sectionTitle, dir]}>🙂 {t.profile}</Text>
              <Text style={[styles.fieldLabel, dir]}>{t.yourName}</Text>
              <TextInput
                value={profileName}
                onChangeText={setProfileName}
                style={[styles.input, dir]}
                placeholder={t.yourName}
                placeholderTextColor="#9BAAA2"
              />
            </View>

            <View style={styles.formCard}>
              <Text style={[styles.sectionTitle, dir]}>👤 {t.myRequests}</Text>

              {myRequests.length === 0 && <Text style={styles.empty}>{t.empty}</Text>}

              {myRequests.map(b => {
                const ride = findRide(b.rideId);
                return (
                  <View key={b.id} style={styles.bookingCard}>
                    <Text style={[styles.city, dir]}>{renderRoute(ride)}</Text>
                    {ride && (
                      <Text style={[styles.muted, dir]}>
                        📅 {ride.date} · 🕒 {ride.time} · {ride.price} DT · {paymentLabel(t, b.payment)}
                      </Text>
                    )}
                    <Text style={[styles.status, styles[`status${b.status}`], dir]}>
                      {statusLabel(t, b.status)}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.formCard}>
              <Text style={[styles.sectionTitle, dir]}>🚘 {t.manage}</Text>
              {receivedRequests.length === 0 && <Text style={styles.empty}>{t.empty}</Text>}

              {receivedRequests.map(b => {
                const ride = findRide(b.rideId);
                return (
                  <View key={b.id} style={styles.bookingCard}>
                    <Text style={[styles.city, dir]}>{renderRoute(ride)}</Text>
                    <Text style={[styles.muted, dir]}>{t.passenger}: {b.passenger}</Text>
                    <Text style={[styles.status, styles[`status${b.status}`], dir]}>
                      {statusLabel(t, b.status)}
                    </Text>
                    {b.status === 'Pending' && (
                      <View style={[styles.actionRow, row]}>
                        <TouchableOpacity style={styles.approveButton} onPress={() => approveBooking(b)}>
                          <Text style={styles.actionText}>{t.approve}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.rejectButton} onPress={() => rejectBooking(b)}>
                          <Text style={styles.actionText}>{t.reject}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}

        <Text style={styles.footer}>Covoiturage TN · Tunisia 🇹🇳</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F7F4' },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  rowReverse: { flexDirection: 'row-reverse' },
  header: {
    backgroundColor: '#075C45',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 26,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { color: '#FFFFFF', fontSize: 23, fontWeight: '900' },
  logoTN: { color: '#9DE5BD' },
  headerSub: { color: '#D1EADF', fontSize: 11, marginTop: 5 },
  langRow: { flexDirection: 'row', gap: 4 },
  langButton: { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, backgroundColor: '#176F56' },
  langActive: { backgroundColor: '#FFFFFF' },
  langText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' },
  langTextActive: { color: '#075C45' },
  heroTitle: { color: '#FFFFFF', fontSize: 27, fontWeight: '900', marginTop: 23 },
  heroSub: { color: '#D1EADF', fontSize: 13, marginTop: 7 },
  nav: {
    flexDirection: 'row',
    marginHorizontal: 15,
    marginTop: -14,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 7,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }
  },
  navItem: { flex: 1, alignItems: 'center', padding: 9, borderRadius: 11 },
  navSelected: { backgroundColor: '#E4F4EA' },
  navIcon: { fontSize: 20, color: '#71877B' },
  navText: { color: '#71877B', fontSize: 11, marginTop: 3, fontWeight: '600' },
  navTextSelected: { color: '#087B53', fontWeight: '900' },
  content: { flex: 1, paddingHorizontal: 15, paddingTop: 18 },
  searchCard: {
    backgroundColor: '#FFFFFF', borderRadius: 19, padding: 17,
    marginBottom: 22, elevation: 2
  },
  formCard: {
    backgroundColor: '#FFFFFF', borderRadius: 19, padding: 18,
    marginBottom: 17, elevation: 2
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: '#173C2D', fontSize: 18, fontWeight: '900', marginBottom: 13 },
  count: { color: '#087B53', fontWeight: 'bold', fontSize: 12 },
  fieldLabel: { color: '#315747', fontSize: 13, fontWeight: '700', marginBottom: 7, marginTop: 9 },
  input: {
    backgroundColor: '#F3F7F4', borderWidth: 1, borderColor: '#E5EEE8',
    borderRadius: 11, padding: 13, fontSize: 14, color: '#173C2D'
  },
  primaryButton: {
    backgroundColor: '#087B53', borderRadius: 12,
    padding: 15, alignItems: 'center', marginTop: 15
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  clearButton: { alignItems: 'center', padding: 8 },
  clearText: { color: '#087B53', fontWeight: '700' },
  rideCard: {
    backgroundColor: '#FFFFFF', borderRadius: 18,
    padding: 16, marginBottom: 13, elevation: 2
  },
  rideTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routeBox: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 },
  city: { color: '#173C2D', fontSize: 16, fontWeight: '900' },
  arrow: { color: '#087B53', fontSize: 16, fontWeight: 'bold' },
  priceBox: { alignItems: 'flex-end', marginLeft: 8 },
  priceBoxRtl: { alignItems: 'flex-start', marginLeft: 0, marginRight: 8 },
  price: { color: '#087B53', fontSize: 21, fontWeight: '900' },
  muted: { color: '#83948A', fontSize: 11, marginTop: 4 },
  line: { height: 1, backgroundColor: '#EAF0EC', marginVertical: 13 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9 },
  info: { color: '#526B5E', fontSize: 12, flex: 1 },
  seatRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', backgroundColor: '#EFF8F2',
    padding: 11, borderRadius: 11, marginTop: 4
  },
  seatTitle: { color: '#087B53', fontWeight: '900', fontSize: 13 },
  seatBadge: { backgroundColor: '#D6F0DF', borderRadius: 9, padding: 8 },
  seatBadgeText: { color: '#087B53', fontWeight: '900' },
  paymentRow: { marginTop: 9 },
  disabled: { backgroundColor: '#A9B8AF' },
  choiceRow: { flexDirection: 'row', gap: 7, marginTop: 8 },
  choice: { flex: 1, padding: 11, borderRadius: 10, backgroundColor: '#F0F5F1', alignItems: 'center' },
  choiceActive: { backgroundColor: '#087B53' },
  choiceText: { color: '#526B5E', fontSize: 11, fontWeight: '700' },
  choiceTextActive: { color: '#FFFFFF' },
  bookingCard: { backgroundColor: '#F3F8F4', borderRadius: 12, padding: 13, marginTop: 10 },
  status: { fontSize: 12, fontWeight: '900', marginTop: 6 },
  statusPending: { color: '#B7791F' },
  statusApproved: { color: '#087B53' },
  statusRejected: { color: '#B94343' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  approveButton: { flex: 1, backgroundColor: '#087B53', padding: 11, borderRadius: 9, alignItems: 'center' },
  rejectButton: { flex: 1, backgroundColor: '#B94343', padding: 11, borderRadius: 9, alignItems: 'center' },
  actionText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  empty: { color: '#83948A', textAlign: 'center', padding: 22 },
  footer: { textAlign: 'center', color: '#9AAA9F', fontSize: 11, marginTop: 20, marginBottom: 15 }
});
