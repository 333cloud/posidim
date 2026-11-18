import { useMemo, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

type EventItem = {
  id: number;
  title: string;
  category: string;
  place: string;
  time: string;
  people: number;
  capacity: number;
  host: string;
  initials: string;
  accent: string;
  description: string;
};

const EVENTS: EventItem[] = [
  {
    id: 1,
    title: "Вечер настольных игр",
    category: "Игры",
    place: "Центр · уютное кафе",
    time: "Сегодня, 19:00",
    people: 3,
    capacity: 5,
    host: "Алексей",
    initials: "А",
    accent: "#8B7CFF",
    description: "Ищем компанию для лёгких настолок, общения и хорошего вечера. Новичкам тоже рады."
  },
  {
    id: 2,
    title: "Кофе и разговоры",
    category: "Кофе",
    place: "Рядом с парком",
    time: "Завтра, 12:30",
    people: 2,
    capacity: 4,
    host: "Марина",
    initials: "М",
    accent: "#E7A66A",
    description: "Без спешки познакомимся, выпьем кофе и обсудим всё на свете."
  },
  {
    id: 3,
    title: "Прогулка и новые знакомства",
    category: "Прогулка",
    place: "Городской парк",
    time: "Суббота, 15:00",
    people: 4,
    capacity: 6,
    host: "Игорь",
    initials: "И",
    accent: "#69C6A5",
    description: "Пройдёмся по красивому маршруту, познакомимся и найдём новых друзей."
  },
  {
    id: 4,
    title: "По бокалу после работы",
    category: "Общение",
    place: "Бар в центре",
    time: "Пятница, 20:00",
    people: 2,
    capacity: 4,
    host: "Денис",
    initials: "Д",
    accent: "#E47C91",
    description: "Неформальный вечер в общественном месте. Можно прийти просто пообщаться."
  }
];

const FILTERS = ["Все", "Кофе", "Игры", "Прогулка", "Общение"];

export default function HomeScreen() {
  const [activeFilter, setActiveFilter] = useState("Все");
  const [joined, setJoined] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("Встречи");

  const visibleEvents = useMemo(() => EVENTS.filter((event) => {
    const matchesFilter = activeFilter === "Все" || event.category === activeFilter;
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [event.title, event.place, event.description].some((value) => value.toLowerCase().includes(query));
    return matchesFilter && matchesSearch;
  }), [activeFilter, search]);

  const toggleJoin = (id: number) => {
    setJoined((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.page}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.topLine}>
            <View>
              <Text style={styles.logo}>ПОСИДИМ<span> </span><Text style={styles.logoDot}>.</Text></Text>
              <Text style={styles.tagline}>Люди рядом. Встречи по душе.</Text>
            </View>
            <View style={styles.avatar}><Text style={styles.avatarText}>Я</Text></View>
          </View>

          <View style={styles.hero}>
            <Text style={styles.eyebrow}>ТВОЙ ГОРОД, ТВОЯ КОМПАНИЯ</Text>
            <Text style={styles.heroTitle}>Не сиди один.<Text style={styles.heroAccent}> Посидим?</Text></Text>
            <Text style={styles.heroText}>Находи людей, собирай компанию и проводи время так, как нравится тебе.</Text>
            <View style={styles.locationPill}><Text style={styles.locationPin}>⌖</Text><Text style={styles.locationText}>Мой город · радиус 10 км</Text><Text style={styles.chevron}>⌄</Text></View>
          </View>

          <View style={styles.sectionHeader}>
            <View><Text style={styles.sectionTitle}>Куда сегодня?</Text><Text style={styles.sectionSubtitle}>Встречи, которые ищут компанию</Text></View>
            <Text style={styles.count}>{visibleEvents.length} рядом</Text>
          </View>

          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Поиск по встречам и местам"
              placeholderTextColor="#777D8C"
              style={styles.searchInput}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {FILTERS.map((filter) => (
              <TouchableOpacity key={filter} onPress={() => setActiveFilter(filter)} style={[styles.filter, activeFilter === filter && styles.filterActive]}>
                <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>{filter}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {visibleEvents.length === 0 ? (
            <View style={styles.empty}><Text style={styles.emptyTitle}>Пока ничего не нашлось</Text><Text style={styles.emptyText}>Попробуй другой запрос или выбери категорию «Все».</Text></View>
          ) : visibleEvents.map((event) => {
            const isJoined = joined.includes(event.id);
            return (
              <View key={event.id} style={styles.eventCard}>
                <View style={styles.cardTop}>
                  <View style={[styles.hostAvatar, { backgroundColor: event.accent + "22" }]}><Text style={[styles.hostInitial, { color: event.accent }]}>{event.initials}</Text></View>
                  <View style={styles.hostInfo}><Text style={styles.hostName}>{event.host}</Text><Text style={styles.hostCaption}>Организатор встречи</Text></View>
                  <View style={styles.category}><Text style={styles.categoryText}>{event.category}</Text></View>
                </View>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <Text style={styles.eventDescription}>{event.description}</Text>
                <View style={styles.metaRow}><Text style={styles.metaIcon}>◷</Text><Text style={styles.metaText}>{event.time}</Text></View>
                <View style={styles.metaRow}><Text style={styles.metaIcon}>⌖</Text><Text style={styles.metaText}>{event.place}</Text></View>
                <View style={styles.cardBottom}>
                  <View><Text style={styles.peopleCount}>{event.people + (isJoined ? 1 : 0)} из {event.capacity} участников</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, ((event.people + (isJoined ? 1 : 0)) / event.capacity) * 100)}%`, backgroundColor: event.accent }]} /></View></View>
                  <TouchableOpacity onPress={() => toggleJoin(event.id)} style={[styles.joinButton, isJoined && styles.joinedButton]}>
                    <Text style={[styles.joinText, isJoined && styles.joinedText]}>{isJoined ? "Вы записаны ✓" : "Хочу пойти"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          <View style={styles.safetyNote}><Text style={styles.safetyIcon}>♡</Text><Text style={styles.safetyText}>Встречайтесь в общественных местах. Уважайте границы друг друга и заботьтесь о безопасности.</Text></View>
          <Text style={styles.footer}>ПОСИДИМ · ПЕРВАЯ ДЕМО-ВЕРСИЯ · 18+</Text>
        </ScrollView>

        <View style={styles.bottomNav}>
          {["Встречи", "Люди", "Создать", "Профиль"].map((item) => (
            <TouchableOpacity key={item} style={styles.navItem} onPress={() => setTab(item)}>
              <Text style={[styles.navSymbol, tab === item && styles.navActive]}>{item === "Встречи" ? "⌂" : item === "Люди" ? "♧" : item === "Создать" ? "+" : "◉"}</Text>
              <Text style={[styles.navLabel, tab === item && styles.navActive]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B0D12" },
  page: { flex: 1, width: "100%", maxWidth: 760, alignSelf: "center", backgroundColor: "#0B0D12" },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
  topLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 25 },
  logo: { color: "#F5F5F7", fontSize: 25, fontWeight: "900", letterSpacing: 1.3 },
  logoDot: { color: "#A78BFA" },
  tagline: { color: "#858B99", fontSize: 12, marginTop: 3 },
  avatar: { width: 42, height: 42, borderRadius: 15, backgroundColor: "#242131", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#39314F" },
  avatarText: { color: "#C4B5FD", fontWeight: "800", fontSize: 16 },
  hero: { backgroundColor: "#171522", borderRadius: 23, padding: 21, borderWidth: 1, borderColor: "#2B263C", marginBottom: 27 },
  eyebrow: { color: "#A78BFA", fontSize: 10, fontWeight: "800", letterSpacing: 1.6, marginBottom: 11 },
  heroTitle: { color: "#F7F5FC", fontSize: 27, fontWeight: "900", lineHeight: 34 },
  heroAccent: { color: "#B6A2FF" },
  heroText: { color: "#A7A3B2", fontSize: 13, lineHeight: 20, marginTop: 9, maxWidth: 390 },
  locationPill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginTop: 17, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#242132" },
  locationPin: { color: "#B6A2FF", fontSize: 17, marginRight: 7 },
  locationText: { color: "#DDD7EE", fontSize: 12, fontWeight: "600" },
  chevron: { color: "#A7A3B2", marginLeft: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 },
  sectionTitle: { color: "#F5F5F7", fontSize: 21, fontWeight: "800" },
  sectionSubtitle: { color: "#858B99", fontSize: 12, marginTop: 4 },
  count: { color: "#AFA0E9", fontSize: 11, fontWeight: "700", paddingBottom: 3 },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#171A22", borderWidth: 1, borderColor: "#282D38", borderRadius: 14, paddingHorizontal: 13, height: 47 },
  searchIcon: { color: "#9298A7", fontSize: 23, marginRight: 9 },
  searchInput: { flex: 1, color: "#F3F4F6", fontSize: 13, outlineStyle: "none" as any },
  filters: { paddingVertical: 15, gap: 8 },
  filter: { borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, backgroundColor: "#171A22", borderWidth: 1, borderColor: "#282D38" },
  filterActive: { backgroundColor: "#A78BFA", borderColor: "#A78BFA" },
  filterText: { color: "#A6ABB7", fontSize: 12, fontWeight: "600" },
  filterTextActive: { color: "#171322", fontWeight: "800" },
  eventCard: { backgroundColor: "#151820", borderRadius: 19, borderWidth: 1, borderColor: "#292E39", padding: 16, marginBottom: 13 },
  cardTop: { flexDirection: "row", alignItems: "center", marginBottom: 13 },
  hostAvatar: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  hostInitial: { fontSize: 16, fontWeight: "900" },
  hostInfo: { marginLeft: 10, flex: 1 },
  hostName: { color: "#ECEEF3", fontSize: 12, fontWeight: "700" },
  hostCaption: { color: "#7E8491", fontSize: 10, marginTop: 3 },
  category: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, backgroundColor: "#242132" },
  categoryText: { color: "#C7B8FF", fontSize: 10, fontWeight: "700" },
  eventTitle: { color: "#F4F4F6", fontSize: 17, fontWeight: "800", marginBottom: 6 },
  eventDescription: { color: "#9CA2AE", fontSize: 12, lineHeight: 18, marginBottom: 13 },
  metaRow: { flexDirection: "row", alignItems: "center", marginBottom: 7 },
  metaIcon: { color: "#A995F3", fontSize: 15, width: 22 },
  metaText: { color: "#B9BEC8", fontSize: 11 },
  cardBottom: { borderTopWidth: 1, borderTopColor: "#292E39", marginTop: 8, paddingTop: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  peopleCount: { color: "#9DA3AF", fontSize: 10, marginBottom: 7 },
  progressTrack: { width: 105, height: 4, backgroundColor: "#303541", borderRadius: 5, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 5 },
  joinButton: { backgroundColor: "#A78BFA", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 11 },
  joinedButton: { backgroundColor: "#262B35", borderWidth: 1, borderColor: "#6D5BA9" },
  joinText: { color: "#191426", fontSize: 11, fontWeight: "800" },
  joinedText: { color: "#C7B8FF" },
  empty: { padding: 25, alignItems: "center", backgroundColor: "#151820", borderRadius: 16, marginTop: 5 },
  emptyTitle: { color: "#F4F4F6", fontWeight: "800", fontSize: 15 },
  emptyText: { color: "#9298A5", textAlign: "center", fontSize: 12, marginTop: 7, lineHeight: 18 },
  safetyNote: { flexDirection: "row", backgroundColor: "#171A22", borderRadius: 14, padding: 13, marginTop: 9, alignItems: "center" },
  safetyIcon: { color: "#B6A2FF", fontSize: 19, marginRight: 10 },
  safetyText: { color: "#969CAA", fontSize: 10, lineHeight: 16, flex: 1 },
  footer: { color: "#555B68", fontSize: 9, textAlign: "center", letterSpacing: 1.1, marginTop: 22, marginBottom: 5 },
  bottomNav: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", backgroundColor: "#11141B", borderTopWidth: 1, borderTopColor: "#272C36", paddingTop: 10, paddingBottom: 9 },
  navItem: { alignItems: "center", minWidth: 62 },
  navSymbol: { color: "#737987", fontSize: 21, marginBottom: 3 },
  navLabel: { color: "#737987", fontSize: 9, fontWeight: "600" },
  navActive: { color: "#B9A8FF" }
});
