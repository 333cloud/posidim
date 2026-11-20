import React, { createElement, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking, PanResponder, Platform } from "react-native";
import { WebView } from "react-native-webview";
import { supabase } from "../lib/supabase";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Alert, Image, Modal, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

type EventItem = { id:string|number; host_id?:string; title:string; category:string; place:string; time:string; people:number; capacity:number; host:string; initials:string; accent:string; description:string; startsAt?:string; pendingRequests?:number };
function MapSurface({ city, radius, events, people = [], userLocation = null }: { city: string; radius: string; events: EventItem[]; people?: any[]; userLocation?: {latitude:number;longitude:number}|null }) {
 const km = Number.parseInt(radius, 10) || 10;
 const safeCity = JSON.stringify(city.trim());
 const safeUserLocation = userLocation ? JSON.stringify({lat:userLocation.latitude,lon:userLocation.longitude}) : "null";
 const safeEvents = JSON.stringify(events.slice(0,8).map(e=>({title:e.title,place:e.place,category:e.category})));
 const safePeople = JSON.stringify(people.filter(p=>Number.isFinite(Number(p.approx_latitude))&&Number.isFinite(Number(p.approx_longitude))).slice(0,100).map(p=>({name:p.display_name,lat:Number(p.approx_latitude),lon:Number(p.approx_longitude),distance:Math.round(Number(p.distance_km)*2)/2})));
 const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css"><style>html,body,#map{height:100%;width:100%;margin:0;background:#e8e6df}.leaflet-container{font:13px system-ui}.leaflet-control-attribution{font-size:9px!important}.leaflet-bar a{color:#222!important}.leaflet-control-zoom a{width:38px!important;height:38px!important;line-height:38px!important;font-size:22px!important}</style></head><body><div id="map"></div><script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"></script><script>
(async()=>{const city=${safeCity};const km=${km};const events=${safeEvents};const people=${safePeople};const userLocation=${safeUserLocation};const map=L.map('map',{zoomControl:true,scrollWheelZoom:true,dragging:true,touchZoom:true,doubleClickZoom:true}).setView([25,0],2);
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors &copy; CARTO'}).addTo(map);
let circle=null;
const applyRadius=(lat,lon)=>{if(circle)map.removeLayer(circle);circle=L.circle([lat,lon],{radius:km*1000,color:'#7956c7',weight:2,fillColor:'#a78bfa',fillOpacity:.12}).addTo(map);map.fitBounds(circle.getBounds(),{padding:[28,28]});};
if(userLocation){applyRadius(userLocation.lat,userLocation.lon);}else if(city){try{const q=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(city));const hits=await q.json();if(hits&&hits[0])applyRadius(Number(hits[0].lat),Number(hits[0].lon));}catch(e){}}
const esc=v=>String(v||'').replace(/[&<>\"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[ch]));
for(const ev of events){try{const q=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(ev.place+', '+city));const hits=await q.json();if(hits&&hits[0])L.marker([Number(hits[0].lat),Number(hits[0].lon)]).addTo(map).bindPopup('<b>'+esc(ev.title)+'</b><br>'+esc(ev.category)+' · '+esc(ev.place));await new Promise(r=>setTimeout(r,1100));}catch(e){}}
for(const person of people){const marker=L.circleMarker([person.lat,person.lon],{radius:9,color:'#fff',weight:2,fillColor:'#7956c7',fillOpacity:1}).addTo(map);marker.bindPopup('<b>'+esc(person.name)+'</b><br>Примерно '+esc(person.distance)+' км рядом');}
setTimeout(()=>map.invalidateSize(true),250);
window.addEventListener('resize',()=>map.invalidateSize(true));
})();</script></body></html>`;
 if (Platform.OS === "web") return createElement("iframe" as any, { key: city + "-" + radius + "-" + events.length + "-" + people.map(p=>p.id).join(",") + "-" + (userLocation?userLocation.latitude+":"+userLocation.longitude:"city"), srcDoc: html, title: "Карта ПОСИДИМ", style: { width: "100%", height: "100%", border: 0, display: "block" }, loading: "lazy" } as any);
 return <WebView originWhitelist={["*"]} source={{ html }} javaScriptEnabled domStorageEnabled style={{ flex: 1, backgroundColor: "#e8e6df" }} />;
}

const FILTERS = ["Все","Кофе","Игры","Настолки","Прогулка","Кино","Спорт","Общение","Другое"];
const ICEBREAKERS = ["Какой маленький момент за последнее время тебя порадовал?","Если бы завтра был свободный день, как бы ты его провёл(а)?","Какое место в городе ты любишь и советуешь другим?","Какую игру, книгу или фильм ты можешь рекомендовать всем?","Ты больше за спонтанные планы или за всё заранее?","Какое новое занятие тебе хотелось бы попробовать?","Какое путешествие запомнилось тебе больше всего?","Что обычно помогает тебе перезагрузиться после сложного дня?"];
const INTEREST_TO_ACTIVITY:Record<string,string> = {"☕ Хочу кофе":"Кофе","🚶 Хочу гулять":"Прогулка","🎲 Настолки":"Настольные игры","💬 Открыт к общению":"Общение","🎉 Развлечься":"Развлечься"};
const QUICK_ACTIVITIES = ["Кофе","Прогулка","Кино","Спорт","Настольные игры","Общение","Развлечься"];
const QUICK_TIMES = ["Через 20 минут","Через 30 минут","Через час","Через 2 часа"];
const formatDateInput = (date:Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const formatTimeInput = (date:Date) => `${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`;
export default function HomeScreen() {
 const [session,setSession] = useState<any>(null);
 const [authLoading,setAuthLoading] = useState(true);
 const [authMode,setAuthMode] = useState<"login"|"signup">("signup");
 const [email,setEmail] = useState("");
 const [password,setPassword] = useState("");
 const [authName,setAuthName] = useState("");
 const [authAge,setAuthAge] = useState("");
 const [authCity,setAuthCity] = useState("");
 const [authBusy,setAuthBusy] = useState(false);
 const [resetBusy,setResetBusy] = useState(false);
 const [authMessage,setAuthMessage] = useState("");
 const [authChannel,setAuthChannel] = useState<"email"|"phone">("email");
 const [phone,setPhone] = useState("");
 const [phoneOtp,setPhoneOtp] = useState("");
 const [phoneOtpSent,setPhoneOtpSent] = useState(false);
 const [avatarUrl,setAvatarUrl] = useState<string|null>(null);
 const [avatarBusy,setAvatarBusy] = useState(false);
 const [profilePhotos,setProfilePhotos] = useState<any[]>([]);
 const [viewingProfile,setViewingProfile] = useState<any>(null);
 const [viewingPhotos,setViewingPhotos] = useState<any[]>([]);
 const [viewingProfileBusy,setViewingProfileBusy] = useState(false);
 const [photosBusy,setPhotosBusy] = useState(false);
 const [moodStatus,setMoodStatus] = useState("💬 Открыт к общению");
 const [moodBusy,setMoodBusy] = useState(false);
 const [tab,setTab] = useState("Главная");
 const [events,setEvents] = useState<EventItem[]>([]);
 const [eventMemberships,setEventMemberships] = useState<Record<string,string>>({});
 const [managedEvent,setManagedEvent] = useState<any>(null);
 const [pendingEventRequests,setPendingEventRequests] = useState<any[]>([]);
 const [requestsBusy,setRequestsBusy] = useState(false);
 const [requestActionBusy,setRequestActionBusy] = useState<string|null>(null);
 const [search,setSearch] = useState("");
 const [filter,setFilter] = useState("Все");
 const [createOpen,setCreateOpen] = useState(false);
 const [editingEvent,setEditingEvent] = useState<any>(null);
 const [title,setTitle] = useState("");
 const [place,setPlace] = useState("");
 const [description,setDescription] = useState("");
 const [category,setCategory] = useState("Общение");
 const [capacity,setCapacity] = useState(6);
 const [eventDate,setEventDate] = useState(()=>formatDateInput(new Date(Date.now()+60*60*1000)));
 const [eventTime,setEventTime] = useState(()=>formatTimeInput(new Date(Date.now()+60*60*1000)));
 const [name,setName] = useState("Гость");
 const [age,setAge] = useState("18");
 const [bio,setBio] = useState("Открыт новым знакомствам");
 const [saved,setSaved] = useState(false);
 const [liked,setLiked] = useState<string[]>([]);
 const [myLikes,setMyLikes] = useState<any[]>([]);
 const [incomingLikes,setIncomingLikes] = useState<any[]>([]);
 const [matches,setMatches] = useState<any[]>([]);
 const [likesBusy,setLikesBusy] = useState(false);
 const [likesSearch,setLikesSearch] = useState("");
 const [quickOpen,setQuickOpen] = useState(false);
 const [quickActivity,setQuickActivity] = useState("Прогулка");
 const [quickTime,setQuickTime] = useState("Через 30 минут");
 const [mood,setMood] = useState("💬 Открыт к общению");
 const [radius,setRadius] = useState("10 км");
 const [mapVisible,setMapVisible] = useState(false);
 const [profileCity,setProfileCity] = useState(session?.user?.user_metadata?.city||"");
 const [nearbyProfiles,setNearbyProfiles] = useState<any[]>([]);
 const [discoveryLoading,setDiscoveryLoading] = useState(false);
 const [discoverySearch,setDiscoverySearch] = useState("");
 const [discoveryAgeMin,setDiscoveryAgeMin] = useState("18");
 const [discoveryAgeMax,setDiscoveryAgeMax] = useState("120");
 const [locationSharing,setLocationSharing] = useState(false);
 const [locationBusy,setLocationBusy] = useState(false);
 const [ownLocation,setOwnLocation] = useState<{latitude:number;longitude:number}|null>(null);
 const [inviteOpen,setInviteOpen] = useState(false);
 const [inviteEvent,setInviteEvent] = useState<any>(null);
 const [inviteCandidates,setInviteCandidates] = useState<any[]>([]);
 const [selectedInvitees,setSelectedInvitees] = useState<string[]>([]);
 const [invitations,setInvitations] = useState<any[]>([]);
 const [groupEvents,setGroupEvents] = useState<any[]>([]);
 const [activeChat,setActiveChat] = useState<any>(null);
 const [chatMessages,setChatMessages] = useState<any[]>([]);
 const [chatHasMore,setChatHasMore] = useState(false);
 const [chatLoadingOlder,setChatLoadingOlder] = useState(false);
 const [chatDraft,setChatDraft] = useState("");
 const [chatDraftEventId,setChatDraftEventId] = useState<string|null>(null);
 const [groupMessageSearch,setGroupMessageSearch] = useState("");
 const [chatBusy,setChatBusy] = useState(false);
 const [directConversations,setDirectConversations] = useState<any[]>([]);
 const [activeDirectChat,setActiveDirectChat] = useState<any>(null);
 const activeChatIdRef=useRef<string|null>(null);
 const activeDirectChatIdRef=useRef<string|null>(null);
 activeChatIdRef.current=activeChat?.id?String(activeChat.id):null;
 activeDirectChatIdRef.current=activeDirectChat?.id?String(activeDirectChat.id):null;
 const [directMessages,setDirectMessages] = useState<any[]>([]);
 const [directHasMore,setDirectHasMore] = useState(false);
 const [directLoadingOlder,setDirectLoadingOlder] = useState(false);
 const [directSearch,setDirectSearch] = useState("");
 const [directMessageSearch,setDirectMessageSearch] = useState("");
 const [directDraft,setDirectDraft] = useState("");
 const [directDraftConversationId,setDirectDraftConversationId] = useState<string|null>(null);
 const [directBusy,setDirectBusy] = useState(false);
 const [messagePreference,setMessagePreference] = useState("matches");
 const [messagePreferenceBusy,setMessagePreferenceBusy] = useState(false);
 const [blockedUsers,setBlockedUsers] = useState<any[]>([]);
 const [blocksBusy,setBlocksBusy] = useState(false);
 const [isModerator,setIsModerator] = useState(false);
 const [moderationQueue,setModerationQueue] = useState<any[]>([]);
 const [moderationBusy,setModerationBusy] = useState(false);
 const [deleteBusy,setDeleteBusy] = useState(false);

 useEffect(()=>{
  if(Platform.OS==="web")return;
  const openNotificationDestination=(response:any)=>{
   const kind=response?.notification?.request?.content?.data?.kind;
   if(kind==="like")setTab("Симпатии");
   else if(kind==="invitation")setTab("Встречи");
   else if(kind==="direct_message"||kind==="group_message")setTab("Чаты");
  };
  void Notifications.getLastNotificationResponseAsync().then(response=>{
   if(response){
    openNotificationDestination(response);
    void Notifications.clearLastNotificationResponseAsync();
   }
  }).catch(()=>{});
  const subscription=Notifications.addNotificationResponseReceivedListener(openNotificationDestination);
  return()=>subscription.remove();
 },[]);

 const [pushBusy,setPushBusy] = useState(false);
 const [pushEnabled,setPushEnabled] = useState(false);
 const [quickPrefsOwner,setQuickPrefsOwner] = useState<string|null>(null);
 useEffect(()=>{
  supabase.auth.getSession().then(({data})=>{setSession(data.session);setAuthLoading(false);}).catch(()=>setAuthLoading(false));
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,nextSession)=>{setSession(nextSession);});
  return ()=>subscription.unsubscribe();
 },[]);
 useEffect(()=>{
  if(!session?.user?.id){setEventMemberships({});return;}
  let active=true;
  (async()=>{
   const {data,error}=await supabase.from("event_members").select("event_id,status").eq("user_id",session.user.id);
   if(error){console.warn("Не удалось загрузить мои заявки на встречи:",error.message);return;}
   if(!active)return;
   const next:Record<string,string>={};
   (data||[]).forEach((row:any)=>{next[String(row.event_id)]=row.status;});
   setEventMemberships(next);
  })();
  return ()=>{active=false;};
 },[session?.user?.id,tab]);
 useEffect(()=>{
  const userId=session?.user?.id;
  if(!userId){setQuickPrefsOwner(null);setPushEnabled(false);return;}
  let live=true;
  const key="posidim:quick-preferences:"+userId;
  AsyncStorage.getItem(key).then(raw=>{
   if(!live)return;
   if(raw){
    try{
     const saved=JSON.parse(raw);
     if(typeof saved?.mood==="string"&&Object.prototype.hasOwnProperty.call(INTEREST_TO_ACTIVITY,saved.mood)){setMood(saved.mood);setQuickActivity(INTEREST_TO_ACTIVITY[saved.mood]);}
     if(typeof saved?.quickActivity==="string"&&QUICK_ACTIVITIES.includes(saved.quickActivity))setQuickActivity(saved.quickActivity);
     if(typeof saved?.quickTime==="string"&&QUICK_TIMES.includes(saved.quickTime))setQuickTime(saved.quickTime);
    }catch(error){console.warn("Не удалось прочитать быстрые предпочтения:",error);}
   }
   setQuickPrefsOwner(userId);
  }).catch(error=>{
   console.warn("Не удалось загрузить быстрые предпочтения:",error?.message||error);
   if(live)setQuickPrefsOwner(userId);
  });
  return ()=>{live=false;};
 },[session?.user?.id]);
 useEffect(()=>{
  const userId=session?.user?.id;
  if(!userId||quickPrefsOwner!==userId)return;
  const key="posidim:quick-preferences:"+userId;
  void AsyncStorage.setItem(key,JSON.stringify({mood,quickActivity,quickTime})).catch(error=>console.warn("Не удалось сохранить быстрые предпочтения:",error?.message||error));
 },[session?.user?.id,quickPrefsOwner,mood,quickActivity,quickTime]);
 useEffect(()=>{if(!session?.user?.id){setInvitations([]);setGroupEvents([]);return;}const uid=session.user.id;(async()=>{const [inv,mem,host]=await Promise.all([supabase.from("event_invitations").select("id,event_id,created_at,events(id,title,category,venue,capacity,status)").eq("invitee_id",uid).eq("status","pending").order("created_at",{ascending:false}),supabase.from("event_members").select("event_id,events(id,title,category,venue,capacity,status)").eq("user_id",uid).eq("status","accepted"),supabase.from("events").select("id,title,category,venue,capacity,status").eq("host_id",uid)]);if(!inv.error)setInvitations(inv.data||[]);const memberEvents=(mem.data||[]).map((x:any)=>x.events).filter(Boolean);const all=[...(host.data||[]),...memberEvents];setGroupEvents(all.filter((x:any,i:number,a:any[])=>a.findIndex(y=>y.id===x.id)===i));})();},[session?.user?.id,tab]);
 useEffect(()=>{
  if(!activeChat?.id||!session?.user?.id){setChatDraft("");setChatDraftEventId(null);return;}
  let live=true;
  const eventId=String(activeChat.id);
  const key="posidim:group-draft:"+session.user.id+":"+eventId;
  setChatDraft("");setChatDraftEventId(null);
  AsyncStorage.getItem(key).then(saved=>{
   if(!live)return;
   setChatDraft(saved||"");
   setChatDraftEventId(eventId);
  }).catch(error=>{
   console.warn("Не удалось восстановить черновик группового сообщения:",error?.message||error);
   if(live)setChatDraftEventId(eventId);
  });
  return ()=>{live=false;};
 },[activeChat?.id,session?.user?.id]);
 useEffect(()=>{
  if(!activeChat?.id||!session?.user?.id||chatDraftEventId!==String(activeChat.id))return;
  const key="posidim:group-draft:"+session.user.id+":"+String(activeChat.id);
  const save=chatDraft.trim()?AsyncStorage.setItem(key,chatDraft):AsyncStorage.removeItem(key);
  void save.catch(error=>console.warn("Не удалось сохранить черновик группового сообщения:",error?.message||error));
 },[chatDraft,chatDraftEventId,activeChat?.id,session?.user?.id]);
 useEffect(()=>{if(!activeChat?.id||!session?.user?.id){setChatMessages([]);setChatHasMore(false);setChatLoadingOlder(false);setGroupMessageSearch("");return;}let live=true;setChatMessages([]);setChatHasMore(false);setChatLoadingOlder(false);setGroupMessageSearch("");const load=async()=>{const {data,error}=await supabase.from("messages").select("id,sender_id,body,created_at").eq("event_id",activeChat.id).order("created_at",{ascending:false}).limit(50);if(live&&!error){setChatMessages((data||[]).reverse());setChatHasMore((data||[]).length===50);}};load();const channel=supabase.channel("event-"+activeChat.id).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:"event_id=eq."+activeChat.id},(payload:any)=>{if(live)setChatMessages(items=>items.some(x=>x.id===payload.new.id)?items:[...items,payload.new].sort((a,b)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime()));}).subscribe();return()=>{live=false;supabase.removeChannel(channel);};},[activeChat?.id,session?.user?.id]);
 const loadOlderGroupMessages=async()=>{if(!activeChat?.id||!chatMessages.length||chatLoadingOlder||!chatHasMore)return;const eventId=String(activeChat.id);setChatLoadingOlder(true);try{const oldest=chatMessages[0].created_at;const {data,error}=await supabase.from("messages").select("id,sender_id,body,created_at").eq("event_id",eventId).lt("created_at",oldest).order("created_at",{ascending:false}).limit(50);if(error)throw error;if(activeChatIdRef.current!==eventId)return;const older=(data||[]).reverse();setChatMessages(items=>{const known=new Set(items.map(item=>item.id));return [...older.filter(item=>!known.has(item.id)),...items];});setChatHasMore((data||[]).length===50);}catch(e:any){if(activeChatIdRef.current===eventId)Alert.alert("Не удалось загрузить историю чата",e?.message||"Попробуй ещё раз.");}finally{if(activeChatIdRef.current===eventId)setChatLoadingOlder(false);}};
 const loadDirectConversations=async()=>{if(!session?.user?.id)return;try{const {data,error}=await supabase.from("direct_conversations").select("id,user_one,user_two,updated_at").or("user_one.eq."+session.user.id+",user_two.eq."+session.user.id).order("updated_at",{ascending:false});if(error)throw error;const rows=data||[];const ids=rows.map((x:any)=>x.user_one===session.user.id?x.user_two:x.user_one);const conversationIds=rows.map((x:any)=>x.id);const [{data:people,error:peopleError},{data:messages,error:messagesError}]=await Promise.all([ids.length?supabase.from("profiles").select("id,display_name,age,avatar_url,city").in("id",ids):Promise.resolve({data:[],error:null}),conversationIds.length?supabase.from("direct_messages").select("id,conversation_id,sender_id,body,created_at").in("conversation_id",conversationIds).order("created_at",{ascending:false}).limit(500):Promise.resolve({data:[],error:null})]);if(peopleError)throw peopleError;if(messagesError)throw messagesError;const byId=new Map((people||[]).map((p:any)=>[p.id,p]));const latestByConversation=new Map<string,any>();for(const message of messages||[])if(!latestByConversation.has(message.conversation_id))latestByConversation.set(message.conversation_id,message);const enriched=rows.map((x:any)=>({...x,person:byId.get(x.user_one===session.user.id?x.user_two:x.user_one),lastMessage:latestByConversation.get(x.id)||null})).filter((x:any)=>x.person);enriched.sort((a:any,b:any)=>new Date(b.lastMessage?.created_at||b.updated_at).getTime()-new Date(a.lastMessage?.created_at||a.updated_at).getTime());setDirectConversations(enriched);}catch(e:any){console.warn("Не удалось загрузить личные чаты:",e?.message||e);}};
 const openDirectChat=async(person:any)=>{if(!session?.user?.id)return;setDirectBusy(true);try{const {data,error}=await supabase.rpc("get_or_create_direct_conversation",{p_other_user_id:person.id});if(error)throw error;setActiveDirectChat({id:data,person});setActiveChat(null);setDirectDraft("");setTab("Чаты");}catch(e:any){Alert.alert("Не удалось открыть личный чат",e?.message||"Личные сообщения доступны после взаимной симпатии.");}finally{setDirectBusy(false);}};
 const loadOlderDirectMessages=async()=>{if(!activeDirectChat?.id||!directMessages.length||directLoadingOlder||!directHasMore)return;const conversationId=String(activeDirectChat.id);setDirectLoadingOlder(true);try{const oldest=directMessages[0].created_at;const {data,error}=await supabase.from("direct_messages").select("id,sender_id,body,created_at").eq("conversation_id",conversationId).lt("created_at",oldest).order("created_at",{ascending:false}).limit(50);if(error)throw error;if(activeDirectChatIdRef.current!==conversationId)return;const older=(data||[]).reverse();setDirectMessages(items=>{const known=new Set(items.map(item=>item.id));return [...older.filter(item=>!known.has(item.id)),...items];});setDirectHasMore((data||[]).length===50);}catch(e:any){if(activeDirectChatIdRef.current===conversationId)Alert.alert("Не удалось загрузить историю",e?.message||"Попробуй ещё раз.");}finally{if(activeDirectChatIdRef.current===conversationId)setDirectLoadingOlder(false);}};
 const sendDirectMessage=async()=>{const body=directDraft.trim();if(!body||directBusy||!activeDirectChat?.id||!session?.user?.id)return;setDirectBusy(true);try{const {data:sent,error}=await supabase.from("direct_messages").insert({conversation_id:activeDirectChat.id,sender_id:session.user.id,body}).select("id,sender_id,body,created_at").single();if(error)throw error;if(sent)setDirectMessages(items=>items.some(item=>item.id===sent.id)?items:[...items,sent]);setDirectDraft("");void loadDirectConversations();if(activeDirectChat.person?.id)void supabase.functions.invoke("send-notification",{body:{recipientId:activeDirectChat.person.id,kind:"direct_message",refId:activeDirectChat.id,messageId:sent.id,title:"Новое сообщение",body:body.slice(0,160)}});}catch(e:any){Alert.alert("Сообщение не отправлено",e?.message||"Проверь подключение и настройки доступа.");}finally{setDirectBusy(false);}};
 useEffect(()=>{if(!session?.user?.id||tab!=="Чаты")return;void loadDirectConversations();const channel=supabase.channel("direct-list-"+session.user.id).on("postgres_changes",{event:"INSERT",schema:"public",table:"direct_messages"},()=>{void loadDirectConversations();}).subscribe();return()=>{supabase.removeChannel(channel);};},[session?.user?.id,tab]);
 useEffect(()=>{
  if(!activeDirectChat?.id||!session?.user?.id){setDirectDraft("");setDirectDraftConversationId(null);return;}
  let live=true;
  const conversationId=String(activeDirectChat.id);
  const key="posidim:direct-draft:"+session.user.id+":"+conversationId;
  setDirectDraft("");setDirectDraftConversationId(null);
  AsyncStorage.getItem(key).then(saved=>{
   if(!live)return;
   setDirectDraft(saved||"");
   setDirectDraftConversationId(conversationId);
  }).catch(error=>{
   console.warn("Не удалось восстановить черновик личного сообщения:",error?.message||error);
   if(live)setDirectDraftConversationId(conversationId);
  });
  return ()=>{live=false;};
 },[activeDirectChat?.id,session?.user?.id]);
 useEffect(()=>{
  if(!activeDirectChat?.id||!session?.user?.id||directDraftConversationId!==String(activeDirectChat.id))return;
  const key="posidim:direct-draft:"+session.user.id+":"+String(activeDirectChat.id);
  const save=directDraft.trim()?AsyncStorage.setItem(key,directDraft):AsyncStorage.removeItem(key);
  void save.catch(error=>console.warn("Не удалось сохранить черновик личного сообщения:",error?.message||error));
 },[directDraft,directDraftConversationId,activeDirectChat?.id,session?.user?.id]);
 useEffect(()=>{if(!activeDirectChat?.id||!session?.user?.id){setDirectMessages([]);setDirectHasMore(false);setDirectLoadingOlder(false);setDirectMessageSearch("");return;}let live=true;setDirectMessages([]);setDirectHasMore(false);setDirectLoadingOlder(false);setDirectMessageSearch("");const load=async()=>{const {data,error}=await supabase.from("direct_messages").select("id,sender_id,body,created_at").eq("conversation_id",activeDirectChat.id).order("created_at",{ascending:false}).limit(50);if(live&&!error){setDirectMessages((data||[]).reverse());setDirectHasMore((data||[]).length===50);}};load();const channel=supabase.channel("direct-"+activeDirectChat.id).on("postgres_changes",{event:"INSERT",schema:"public",table:"direct_messages",filter:"conversation_id=eq."+activeDirectChat.id},(payload:any)=>{if(live)setDirectMessages(items=>items.some(x=>x.id===payload.new.id)?items:[...items,payload.new].sort((a,b)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime()));}).subscribe();return()=>{live=false;supabase.removeChannel(channel);};},[activeDirectChat?.id,session?.user?.id]);
 const respondInvitation=async(id:string,accept:boolean)=>{setChatBusy(true);try{const {data,error}=await supabase.rpc("respond_to_event_invitation",{p_invitation_id:id,p_accept:accept});if(error)throw error;const chosen=invitations.find(x=>x.id===id);setInvitations(items=>items.filter(x=>x.id!==id));if(accept){const ev=chosen?.events||{id:data,title:"Групповая встреча"};setGroupEvents(items=>[ev,...items.filter(x=>x.id!==ev.id)]);setActiveChat(ev);Alert.alert("Ты в компании!","Теперь ты участник встречи и можешь писать в общем чате.");}else Alert.alert("Приглашение отклонено","Ты не будешь добавлен(а) в эту встречу.");}catch(e:any){Alert.alert("Не получилось обработать приглашение",e?.message||"Проверь подключение и SQL-настройки.");}finally{setChatBusy(false);}};
 const sendGroupMessage=async()=>{const body=chatDraft.trim();if(!body||chatBusy||activeChat?.status==="cancelled"||!activeChat?.id||!session?.user?.id)return;setChatBusy(true);try{const {data:sent,error}=await supabase.from("messages").insert({event_id:activeChat.id,sender_id:session.user.id,body}).select("id,sender_id,body,created_at").single();if(error)throw error;if(sent)setChatMessages(items=>items.some(item=>item.id===sent.id)?items:[...items,sent]);setChatDraft("");const [{data:members},{data:event}] = await Promise.all([supabase.from("event_members").select("user_id").eq("event_id",activeChat.id).eq("status","accepted"),supabase.from("events").select("host_id").eq("id",activeChat.id).maybeSingle()]);const recipientIds=Array.from(new Set([...(members||[]).map((x:any)=>x.user_id),event?.host_id].filter((id:any)=>id&&id!==session.user.id)));for(const recipientId of recipientIds)void supabase.functions.invoke("send-notification",{body:{recipientId,kind:"group_message",refId:activeChat.id,messageId:sent.id,title:"Новое сообщение во встрече",body:body.slice(0,160)}});}catch(e:any){Alert.alert("Сообщение не отправлено",e?.message||"Проверь, что SQL-миграция выполнена и ты принят(а) во встречу.");}finally{setChatBusy(false);}};
 useEffect(()=>{if(!session?.user?.id){setAvatarUrl(null);return;} supabase.from("profiles").select("display_name,age,bio,avatar_url,city,is_discoverable,mood_status").eq("id",session.user.id).maybeSingle().then(({data,error})=>{if(error){console.warn(error.message);return;}if(data){if(data.display_name)setName(data.display_name);if(data.age)setAge(String(data.age));if(typeof data.bio==="string")setBio(data.bio);if(data.avatar_url)setAvatarUrl(data.avatar_url);if(data.city)setProfileCity(data.city);if(typeof data.is_discoverable==="boolean")setMapVisible(data.is_discoverable);if(typeof data.mood_status==="string")setMoodStatus(data.mood_status);}});},[session?.user?.id]);
 const loadEvents=async()=>{
  if(!session?.user?.id)return;
  const city=profileCity||session.user.user_metadata?.city||"";
  if(!city){setEvents([]);return;}
  const {data,error}=await supabase.from("events").select("id,title,category,venue,capacity,description,starts_at,host_id").eq("city",city).eq("status","open").gte("starts_at",new Date().toISOString()).order("starts_at",{ascending:true}).limit(50);
  if(error){console.warn("Не удалось загрузить встречи:",error.message);return;}
  const rows=data||[];
  const ownEventIds=rows.filter((event:any)=>event.host_id===session.user.id).map((event:any)=>event.id);
  const pendingCounts=new Map<string,number>();
  if(ownEventIds.length){
   const {data:requests,error:requestsError}=await supabase.from("event_members").select("event_id").in("event_id",ownEventIds).eq("status","requested");
   if(requestsError)console.warn("Не удалось загрузить счётчики заявок:",requestsError.message);
   else (requests||[]).forEach((request:any)=>pendingCounts.set(String(request.event_id),(pendingCounts.get(String(request.event_id))||0)+1));
  }
  setEvents(rows.map((e:any)=>({id:e.id,host_id:e.host_id,title:e.title,category:e.category,place:e.venue,time:new Date(e.starts_at).toLocaleString(),people:1,capacity:e.capacity,host:e.host_id===session.user.id?name:"Участник",initials:"",accent:"#A78BFA",description:e.description||"",startsAt:e.starts_at,pendingRequests:pendingCounts.get(String(e.id))||0})));
 };
 const loadNearby=async()=>{if(!session?.user?.id)return;const city=profileCity||session.user.user_metadata?.city||"";setDiscoveryLoading(true);try{const {data:seen,error:seenError}=await supabase.from("profile_reactions").select("target_id").eq("actor_id",session.user.id);if(seenError)throw seenError;const excluded=new Set((seen||[]).map((x:any)=>x.target_id));if(locationSharing){const {data,error}=await supabase.rpc("find_nearby_profiles",{p_radius_km:Number.parseInt(radius,10)||10});if(error)throw error;setNearbyProfiles((data||[]).filter((p:any)=>!excluded.has(p.id)));return;}if(!city){setNearbyProfiles([]);return;}let query=supabase.from("profiles").select("id,display_name,age,bio,avatar_url,city,mood_status,mood_expires_at").eq("city",city).eq("is_discoverable",true).neq("id",session.user.id).limit(30);if(excluded.size)query=query.not("id","in","("+Array.from(excluded).join(",")+")");const {data,error}=await query;if(error)throw error;setNearbyProfiles(data||[]);}catch(e:any){console.warn("Не удалось загрузить людей:",e?.message||e);Alert.alert("Не удалось найти людей",e?.message||"Проверь SQL-миграцию геолокации.");setNearbyProfiles([]);}finally{setDiscoveryLoading(false);}};
 useEffect(()=>{if(!session?.user?.id)return;let live=true;(async()=>{const {data,error}=await supabase.from("profile_photos").select("id,storage_path,sort_order").eq("user_id",session.user.id).order("sort_order",{ascending:true});if(error){console.warn("Не удалось загрузить фотографии:",error.message);return;}const signed=await Promise.all((data||[]).map(async(photo:any)=>{const {data:urlData,error:urlError}=await supabase.storage.from("profile-photos").createSignedUrl(photo.storage_path,3600);return urlError?null:{...photo,url:urlData.signedUrl};}));if(live)setProfilePhotos(signed.filter(Boolean));})();return()=>{live=false;};},[session?.user?.id]);
 const pickProfilePhoto=async()=>{if(!session?.user?.id||profilePhotos.length>=5)return;setPhotosBusy(true);try{const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:["images"],allowsEditing:true,quality:0.82});if(result.canceled||!result.assets?.[0])return;const asset=result.assets[0];if(asset.fileSize&&asset.fileSize>5*1024*1024)throw new Error("Выбери изображение до 5 МБ.");const mime=asset.mimeType||"image/jpeg";if(!["image/jpeg","image/png","image/webp"].includes(mime))throw new Error("Поддерживаются JPG, PNG и WebP.");const ext=mime==="image/png"?"png":mime==="image/webp"?"webp":"jpg";const path=session.user.id+"/"+Date.now()+"."+ext;const body=asset.file??await(await fetch(asset.uri)).arrayBuffer();const {error:uploadError}=await supabase.storage.from("profile-photos").upload(path,body,{contentType:mime,upsert:false});if(uploadError)throw uploadError;const {data:row,error}=await supabase.from("profile_photos").insert({user_id:session.user.id,storage_path:path,sort_order:profilePhotos.length}).select("id,storage_path,sort_order").single();if(error){await supabase.storage.from("profile-photos").remove([path]);throw error;}const {data:urlData,error:urlError}=await supabase.storage.from("profile-photos").createSignedUrl(path,3600);if(urlError)throw urlError;setProfilePhotos(items=>[...items,{...row,url:urlData.signedUrl}]);}catch(e:any){Alert.alert("Не удалось добавить фотографию",e?.message||"Попробуй ещё раз.");}finally{setPhotosBusy(false);}};
 const openPublicProfile=async(person:any)=>{setViewingProfile(person);setViewingPhotos([]);setViewingProfileBusy(true);try{const {data,error}=await supabase.from("profile_photos").select("id,storage_path,sort_order").eq("user_id",person.id).order("sort_order",{ascending:true});if(error)throw error;const signed=await Promise.all((data||[]).map(async(photo:any)=>{const {data:urlData,error:urlError}=await supabase.storage.from("profile-photos").createSignedUrl(photo.storage_path,3600);return urlError?null:{...photo,url:urlData.signedUrl};}));setViewingPhotos(signed.filter(Boolean));}catch(e:any){Alert.alert("Не удалось открыть фотографии",e?.message||"Проверь доступ к профилю.");}finally{setViewingProfileBusy(false);}};
 const removeProfilePhoto=async(photo:any)=>{try{const {error}=await supabase.from("profile_photos").delete().eq("id",photo.id);if(error)throw error;const {error:storageError}=await supabase.storage.from("profile-photos").remove([photo.storage_path]);if(storageError)console.warn("Фото удалено из профиля, но файл не удалён:",storageError.message);setProfilePhotos(items=>items.filter(x=>x.id!==photo.id));}catch(e:any){Alert.alert("Не удалось удалить фото",e?.message||"Попробуй ещё раз.");}};
 const enablePushNotifications=async()=>{
  if(!session?.user?.id||pushBusy)return;
  if(Platform.OS==="web"){Alert.alert("Push-уведомления","Подключение push для web пока не настроено. Используй Android или iOS приложение.");return;}
  setPushBusy(true);
  try{
   const projectId=Constants.easConfig?.projectId||Constants.expoConfig?.extra?.eas?.projectId;
   if(!projectId)throw new Error("Для push-уведомлений ещё нужно настроить EAS projectId в app.json. Разрешение системы пока не запрашивалось.");
   let permission=await Notifications.getPermissionsAsync();
   if(permission.status!=="granted")permission=await Notifications.requestPermissionsAsync();
   if(permission.status!=="granted"){Alert.alert("Уведомления не разрешены","Разрешение можно включить в настройках устройства. Остальные функции ПОСИДИМ продолжат работать.");return;}
   const token=await Notifications.getExpoPushTokenAsync({projectId});
   const {error}=await supabase.rpc("save_my_push_token",{p_token:token.data,p_device_name:Platform.OS});
   if(error)throw error;
   if(Platform.OS==="android")await Notifications.setNotificationChannelAsync("default",{name:"Уведомления",importance:Notifications.AndroidImportance.DEFAULT});
   setPushEnabled(true);
   Alert.alert("Уведомления подключены","Это устройство зарегистрировано для push-уведомлений.");
  }catch(e:any){Alert.alert("Не удалось подключить уведомления",e?.message||"Проверь настройки push-уведомлений.");}
  finally{setPushBusy(false);}
 };
 const saveProfile=async()=>{
  const parsedAge=Number(age);
  if(!name.trim()){Alert.alert("Укажи имя","Имя нужно, чтобы другие участники могли обращаться к тебе.");return;}
  if(!Number.isInteger(parsedAge)||parsedAge<18||parsedAge>120){Alert.alert("Доступ 18+","Укажи целый возраст от 18 до 120 лет.");return;}
  setSaved(false);setMoodBusy(true);
  try{
   const {error}=await supabase.from("profiles").update({display_name:name.trim(),age:parsedAge,bio:bio.trim(),city:profileCity.trim(),mood_status:moodStatus.trim(),mood_expires_at:moodStatus.trim()?new Date(Date.now()+24*60*60*1000).toISOString():null}).eq("id",session.user.id);
   if(error)throw error;
   setSaved(true);Alert.alert("Сохранено","Профиль, описание и статус обновлены. Статус действует 24 часа.");
  }catch(e:any){Alert.alert("Не удалось сохранить",e?.message||"Проверь подключение и настройки доступа.");}
  finally{setMoodBusy(false);}
 };
 useEffect(()=>{if(!session?.user?.id)return;let live=true;(async()=>{const {data,error}=await supabase.from("user_locations").select("user_id,latitude,longitude").eq("user_id",session.user.id).maybeSingle();if(live&&!error){setLocationSharing(!!data);setOwnLocation(data?{latitude:data.latitude,longitude:data.longitude}:null);}})();return()=>{live=false;};},[session?.user?.id]);
 useEffect(()=>{if(session?.user?.id&&profileCity){loadEvents();loadNearby();}},[session?.user?.id,profileCity,locationSharing,radius]);
 useEffect(()=>{if(session?.user?.id&&(tab==="Карта"||tab==="Главная")){loadEvents();loadNearby();}},[tab]);
 const loadLikes=async()=>{if(!session?.user?.id)return;setLikesBusy(true);try{const [mine,incoming,mutual]=await Promise.all([supabase.rpc("get_my_likes"),supabase.rpc("get_incoming_likes"),supabase.rpc("get_my_matches")]);if(mine.error)throw mine.error;if(incoming.error)throw incoming.error;if(mutual.error)throw mutual.error;setMyLikes(mine.data||[]);setIncomingLikes(incoming.data||[]);setMatches(mutual.data||[]);}catch(e:any){Alert.alert("Не удалось загрузить симпатии",e?.message||"Проверь SQL-миграцию.");}finally{setLikesBusy(false);}};
 const rateProfile=async(targetId:string,liked:boolean)=>{if(!session?.user?.id)return;const matchedPerson=[...nearbyProfiles,...incomingLikes,...myLikes,...matches].find(person=>person.id===targetId);try{const {data:mutual,error}=await supabase.rpc("react_to_profile",{p_target_id:targetId,p_liked:liked});if(error)throw error;if(liked)void supabase.functions.invoke("send-notification",{body:{recipientId:targetId,kind:"like",title:"Новая симпатия",body:"Кому-то понравился твой профиль."}});setNearbyProfiles(items=>items.filter(p=>p.id!==targetId));if(mutual){Alert.alert("У вас совпадение! 💜","Вы понравились друг другу. Теперь можно начать личный разговор.",[{text:"Позже",style:"cancel"},{text:"Написать",onPress:()=>void openDirectChat(matchedPerson||{id:targetId,display_name:"Совпадение"})}]);}if(tab==="Симпатии")await loadLikes();}catch(e:any){Alert.alert("Не получилось сохранить выбор",e?.message||"Проверь SQL-миграцию и попробуй ещё раз.");}};
 useEffect(()=>{if(session?.user?.id&&tab==="Симпатии")loadLikes();},[session?.user?.id,tab]);
 useEffect(()=>{if(session?.user?.id&&tab==="Профиль"){loadBlockedUsers();loadMessagePreference();checkModerator();}},[session?.user?.id,tab]);
 const checkModerator=async()=>{if(!session?.user?.id)return;try{const {data,error}=await supabase.rpc("is_posidim_moderator");if(error)throw error;setIsModerator(!!data);}catch(e:any){setIsModerator(false);}};
 const loadModerationQueue=async()=>{setModerationBusy(true);try{const {data,error}=await supabase.rpc("get_moderation_queue",{p_status:"pending",p_limit:50});if(error)throw error;setModerationQueue(data||[]);}catch(e:any){Alert.alert("Не удалось загрузить жалобы",e?.message||"Проверь права модератора и SQL-миграцию.");}finally{setModerationBusy(false);}};
 const reviewReport=async(report:any,status:"reviewing"|"resolved"|"dismissed")=>{try{const {error}=await supabase.rpc("review_report",{p_report_id:report.id,p_status:status,p_note:null});if(error)throw error;setModerationQueue(items=>items.filter(x=>x.id!==report.id));}catch(e:any){Alert.alert("Не удалось обновить жалобу",e?.message||"Попробуй ещё раз.");}};
 const deleteMyAccount=()=>{const performDelete=async()=>{if(deleteBusy)return;setDeleteBusy(true);try{const {data,error}=await supabase.functions.invoke("delete-account",{body:{}});if(error)throw error;if(!data?.success)throw new Error(data?.error||"Сервер не подтвердил удаление.");await supabase.auth.signOut();if(Platform.OS==="web")window.alert("Аккаунт удалён. Сессия завершена.");else Alert.alert("Аккаунт удалён","Сессия завершена.");}catch(e:any){const message=e?.message||"Проверь, что Edge Function развернута и настроены секреты.";if(Platform.OS==="web")window.alert("Не удалось удалить аккаунт: "+message);else Alert.alert("Не удалось удалить аккаунт",message);}finally{setDeleteBusy(false);}};if(Platform.OS==="web"){if(window.confirm("Удалить аккаунт навсегда?\n\nБудут удалены аккаунт и связанные данные. Это действие нельзя отменить."))void performDelete();return;}Alert.alert("Удалить аккаунт навсегда?","Будут удалены аккаунт и связанные данные. Это действие нельзя отменить.",[{text:"Отмена",style:"cancel"},{text:"Удалить навсегда",style:"destructive",onPress:()=>void performDelete()}]);};
 const openInvitePicker=async(ev:any)=>{setSelectedInvitees([]);try{const {data:members}=await supabase.from("event_members").select("user_id").eq("event_id",ev.id).eq("status","accepted");const availableSeats=Math.max(0,ev.capacity-1-(members||[]).length);setInviteEvent({...ev,availableSeats});const {data:reactions,error}=await supabase.from("profile_reactions").select("target_id").eq("actor_id",session.user.id).eq("liked",true);if(error)throw error;const ids=(reactions||[]).map((x:any)=>x.target_id);if(!ids.length){setInviteCandidates([]);setInviteOpen(true);return;}const {data:people,error:peopleError}=await supabase.from("profiles").select("id,display_name,age,avatar_url").in("id",ids);if(peopleError)throw peopleError;const {data:sent}=await supabase.from("event_invitations").select("invitee_id").eq("event_id",ev.id);const already=new Set((sent||[]).map((x:any)=>x.invitee_id));setInviteCandidates((people||[]).filter((p:any)=>!already.has(p.id)));setInviteOpen(true);}catch(e:any){Alert.alert("Не удалось загрузить список",e?.message||"Попробуй ещё раз.");}};
 const sendInvitations=async()=>{if(!inviteEvent||!selectedInvitees.length)return;setChatBusy(true);try{const rows=selectedInvitees.slice(0,Math.max(0,inviteEvent.availableSeats||0)).map(id=>({event_id:inviteEvent.id,inviter_id:session.user.id,invitee_id:id}));if(!rows.length){Alert.alert("Нет свободных мест","Вместимость включает организатора.");return;}const {data:createdInvites,error}=await supabase.from("event_invitations").insert(rows).select("id,invitee_id");if(error)throw error;for(const invite of createdInvites||[])void supabase.functions.invoke("send-notification",{body:{recipientId:invite.invitee_id,kind:"invitation",refId:invite.id,title:"Приглашение на встречу",body:inviteEvent.title||"Тебя пригласили в компанию."}});setInviteOpen(false);Alert.alert("Приглашения отправлены","Люди увидят их во вкладке «Чаты» и смогут принять или отклонить.");}catch(e:any){Alert.alert("Не удалось отправить приглашения",e?.message||"Проверь, что миграция приглашений выполнена.");}finally{setChatBusy(false);}};
 const loadMessagePreference=async()=>{if(!session?.user?.id)return;const {data,error}=await supabase.rpc("get_my_message_preference");if(error){console.warn("Не удалось загрузить настройки сообщений:",error.message);return;}if(["all","liked","matches"].includes(data))setMessagePreference(data);};
 const saveMessagePreference=async(value:string)=>{if(!["all","liked","matches"].includes(value)||!session?.user?.id)return;setMessagePreferenceBusy(true);try{const {data,error}=await supabase.rpc("set_my_message_preference",{p_allowed_from:value});if(error)throw error;setMessagePreference(data||value);Alert.alert("Настройки сохранены","Кто может начинать с тобой личный чат, обновлено.");}catch(e:any){Alert.alert("Не удалось сохранить настройки",e?.message||"Примени SQL-миграцию настроек сообщений.");}finally{setMessagePreferenceBusy(false);}};
 const loadBlockedUsers=async()=>{if(!session?.user?.id)return;setBlocksBusy(true);try{const {data,error}=await supabase.rpc("get_my_blocked_users");if(error)throw error;setBlockedUsers(data||[]);}catch(e:any){Alert.alert("Не удалось загрузить блокировки",e?.message||"Проверь SQL-пакет функций безопасности.");}finally{setBlocksBusy(false);}};
 const unblockUser=async(person:any)=>{try{const {error}=await supabase.from("user_blocks").delete().eq("blocker_id",session.user.id).eq("blocked_id",person.blocked_id);if(error)throw error;setBlockedUsers(items=>items.filter(x=>x.blocked_id!==person.blocked_id));await loadNearby();Alert.alert("Блокировка снята","Профиль снова может появляться в поиске, если его владелец включил видимость.");}catch(e:any){Alert.alert("Не удалось снять блокировку",e?.message||"Попробуй ещё раз.");}};
 const submitUserReport=async(person:any,reason:string)=>{if(!session?.user?.id||!person?.id)return;try{const {error}=await supabase.from("reports").insert({reporter_id:session.user.id,reported_user_id:person.id,reason});if(error)throw error;Alert.alert("Жалоба отправлена","Спасибо. Мы сохранили обращение для рассмотрения.");}catch(e:any){Alert.alert("Не удалось отправить жалобу",e?.message||"Попробуй ещё раз.");}};
 const reportEvent=(event:any)=>{Alert.alert("Пожаловаться на встречу","Выбери причину обращения.",[{text:"Подозрительное мероприятие",onPress:async()=>{try{const {error}=await supabase.from("reports").insert({reporter_id:session.user.id,event_id:event.id,reason:"Подозрительное мероприятие"});if(error)throw error;Alert.alert("Жалоба отправлена","Спасибо. Мы сохранили обращение для рассмотрения.");}catch(e:any){Alert.alert("Не удалось отправить жалобу",e?.message||"Попробуй ещё раз.");}}},{text:"Небезопасное описание или место",onPress:async()=>{try{const {error}=await supabase.from("reports").insert({reporter_id:session.user.id,event_id:event.id,reason:"Небезопасное описание или место"});if(error)throw error;Alert.alert("Жалоба отправлена","Спасибо. Мы сохранили обращение для рассмотрения.");}catch(e:any){Alert.alert("Не удалось отправить жалобу",e?.message||"Попробуй ещё раз.");}}},{text:"Отмена",style:"cancel"}]);};
 const reportViewedProfile=(person:any)=>{Alert.alert("Пожаловаться на профиль","Выбери причину обращения.",[{text:"Спам или реклама",onPress:()=>submitUserReport(person,"Спам или реклама")},{text:"Оскорбления или домогательства",onPress:()=>submitUserReport(person,"Оскорбления или домогательства")},{text:"Подозрительный или опасный профиль",onPress:()=>submitUserReport(person,"Подозрительный или опасный профиль")},{text:"Отмена",style:"cancel"}]);};
 const reportChatMessage=(message:any,eventId?:string)=>{
  if(!session?.user?.id||!message?.sender_id||message.sender_id===session.user.id)return;
  const submit=async(reason:string)=>{
   try{
    const excerpt=String(message.body||"").slice(0,400);
    const {error}=await supabase.from("reports").insert({reporter_id:session.user.id,reported_user_id:message.sender_id,event_id:eventId||null,reason:reason+" · Текст сообщения: "+excerpt});
    if(error)throw error;
    Alert.alert("Жалоба отправлена","Сообщение передано на рассмотрение вместе с его текстом.");
   }catch(e:any){Alert.alert("Не удалось отправить жалобу",e?.message||"Попробуй ещё раз.");}
  };
  Alert.alert("Пожаловаться на сообщение","Выбери причину обращения.",[
   {text:"Спам или реклама",onPress:()=>void submit("Спам или реклама в сообщении")},
   {text:"Оскорбления или домогательства",onPress:()=>void submit("Оскорбления или домогательства в сообщении")},
   {text:"Угрозы или опасный контент",onPress:()=>void submit("Угрозы или опасный контент в сообщении")},
   {text:"Неприемлемый контент",onPress:()=>void submit("Неприемлемый контент в сообщении")},
   {text:"Отмена",style:"cancel"}
  ]);
 };
 const blockViewedProfile=(person:any)=>{Alert.alert("Заблокировать пользователя?", "Его профиль исчезнет из твоей подборки, а личное общение будет закрыто.",[{text:"Отмена",style:"cancel"},{text:"Заблокировать",style:"destructive",onPress:async()=>{try{const {error}=await supabase.from("user_blocks").insert({blocker_id:session.user.id,blocked_id:person.id});if(error&&error.code!=="23505")throw error;setNearbyProfiles(items=>items.filter(x=>x.id!==person.id));setMatches(items=>items.filter(x=>x.id!==person.id));setMyLikes(items=>items.filter(x=>x.id!==person.id));setIncomingLikes(items=>items.filter(x=>x.id!==person.id));setDirectConversations(items=>items.filter(x=>x.person?.id!==person.id));if(activeDirectChat?.person?.id===person.id)setActiveDirectChat(null);setViewingProfile(null);Alert.alert("Пользователь заблокирован","Его профиль больше не будет показываться тебе.");}catch(e:any){Alert.alert("Не удалось заблокировать",e?.message||"Попробуй ещё раз.");}}}]);};
 const toggleDiscoverability=async()=>{const next=!mapVisible;setMapVisible(next);const {error}=await supabase.from("profiles").update({is_discoverable:next}).eq("id",session.user.id);if(error){setMapVisible(!next);Alert.alert("Не удалось изменить видимость",error.message);return;}if(!next&&locationSharing){await supabase.rpc("delete_my_location");setLocationSharing(false);setOwnLocation(null);setNearbyProfiles([]);}};
 const enableLocationSharing=async()=>{if(!session?.user?.id||locationBusy)return;if(!mapVisible){Alert.alert("Сначала включи видимость","Нажми ВКЛ в блоке «Твоя видимость», чтобы разрешить показ приблизительного положения.");return;}setLocationBusy(true);try{const permission=await Location.requestForegroundPermissionsAsync();if(permission.status!=="granted"){Alert.alert("Геолокация не разрешена","Можно продолжать пользоваться поиском по городу. Точное местоположение не будет сохранено.");return;}const position=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});const {error}=await supabase.rpc("set_my_location",{p_latitude:position.coords.latitude,p_longitude:position.coords.longitude});if(error)throw error;setLocationSharing(true);setOwnLocation({latitude:position.coords.latitude,longitude:position.coords.longitude});Alert.alert("Поиск рядом включён","Другие пользователи увидят только приблизительную область, не твои точные координаты.");}catch(e:any){Alert.alert("Не удалось включить поиск рядом",e?.message||"Попробуй ещё раз.");}finally{setLocationBusy(false);}};
 const disableLocationSharing=async()=>{setLocationBusy(true);try{const {error}=await supabase.rpc("delete_my_location");if(error)throw error;setLocationSharing(false);setOwnLocation(null);Alert.alert("Геопоиск выключен","Твои координаты удалены. Можно продолжить поиск по городу.");}catch(e:any){Alert.alert("Не удалось выключить геопоиск",e?.message||"Попробуй ещё раз.");}finally{setLocationBusy(false);}};
 const pickAvatar=async()=>{if(!session?.user?.id)return;setAvatarBusy(true);try{const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:["images"],allowsEditing:true,aspect:[1,1],quality:0.82});if(result.canceled||!result.assets?.[0])return;const asset=result.assets[0];if(asset.fileSize&&asset.fileSize>5*1024*1024){Alert.alert("Слишком большой файл","Выбери изображение до 5 МБ.");return;}const mime=asset.mimeType||"image/jpeg";if(!["image/jpeg","image/png","image/webp"].includes(mime)){Alert.alert("Формат не поддерживается","Выбери JPG, PNG или WebP.");return;}const ext=mime==="image/png"?"png":mime==="image/webp"?"webp":"jpg";const body=asset.file??await(await fetch(asset.uri)).arrayBuffer();const path=session.user.id+"/avatar."+ext;const {error:uploadError}=await supabase.storage.from("avatars").upload(path,body,{contentType:mime,upsert:true});if(uploadError)throw uploadError;const url=supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl+"?v="+Date.now();const {error}=await supabase.from("profiles").update({avatar_url:url}).eq("id",session.user.id);if(error)throw error;setAvatarUrl(url);Alert.alert("Готово","Аватарка сохранена в профиле.");}catch(error:any){Alert.alert("Не удалось загрузить фото",error?.message||"Попробуй ещё раз.");}finally{setAvatarBusy(false);}};
 const resetPasswordEmail=async()=>{
  setAuthMessage("");
  const address=email.trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)){
   setAuthMessage("Введи корректный адрес электронной почты.");
   return;
  }
  setResetBusy(true);
  try{
   const redirectTo=Platform.OS==="web"
    ?(typeof window!=="undefined"?new URL("/auth/callback",window.location.origin).toString():undefined)
    :"posidim://auth/callback";
   const {error}=await supabase.auth.resetPasswordForEmail(address,redirectTo?{redirectTo}:undefined);
   if(error)throw error;
   setAuthMessage("Если аккаунт с таким адресом существует, письмо для восстановления уже отправлено. Открой ссылку из письма на этом устройстве.");
  }catch(error:any){
   setAuthMessage(error?.message||"Не удалось отправить письмо. Проверь адрес и попробуй ещё раз.");
  }finally{setResetBusy(false);}
 };
 const handleAuth = async () => {
  setAuthMessage("");
  if(!email.trim()||!password){setAuthMessage("Введи email и пароль.");return;}
  if(password.length<6){setAuthMessage("Пароль должен содержать минимум 6 символов.");return;}
  setAuthBusy(true);
  try {
   if(authMode==="signup"){
    const numericAge=Number(authAge);
    if(!authName.trim()||!authCity.trim()){setAuthMessage("Укажи имя и город.");setAuthBusy(false);return;}
    if(!Number.isInteger(numericAge)||numericAge<18||numericAge>120){setAuthMessage("Регистрация доступна только с 18 лет. Проверь возраст.");setAuthBusy(false);return;}
    const emailRedirectTo=Platform.OS==="web"?(typeof window!=="undefined"?new URL("/auth/confirm",window.location.origin).toString():undefined):"posidim://auth/confirm";
    const {data,error}=await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo,data:{display_name:authName.trim(),age:numericAge,city:authCity.trim()}}});
    if(error) throw error;
    setName(authName.trim());setAge(String(numericAge));
    if(!data.session){setAuthMessage("Аккаунт создан. Проверь почту и подтверди адрес, затем войди.");setAuthMode("login");}
   } else {
    const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
    if(error) throw error;
   }
  } catch(error:any) {setAuthMessage(error?.message||"Не удалось выполнить вход. Попробуй ещё раз.");}
  finally {setAuthBusy(false);}
 };
 const startPhoneAuth=async()=>{
  setAuthMessage("");
  const number=phone.trim().replace(/[\\s()-]/g,"");
  if(!/^\\+[1-9]\\d{7,14}$/.test(number)){setAuthMessage("Укажи номер в международном формате, например +37255555555.");return;}
  if(authMode==="signup"){
   const numericAge=Number(authAge);
   if(!authName.trim()||!authCity.trim()){setAuthMessage("Для регистрации укажи имя и город.");return;}
   if(!Number.isInteger(numericAge)||numericAge<18||numericAge>120){setAuthMessage("Регистрация доступна только с 18 лет.");return;}
  }
  setAuthBusy(true);
  try{
   const options:any={shouldCreateUser:authMode==="signup"};
   if(authMode==="signup")options.data={display_name:authName.trim(),age:Number(authAge),city:authCity.trim()};
   const {error}=await supabase.auth.signInWithOtp({phone:number,options});
   if(error)throw error;
   setPhone(number);setPhoneOtpSent(true);setAuthMessage("Код отправлен по SMS. Введи его ниже.");
  }catch(error:any){setAuthMessage(error?.message||"Не удалось отправить SMS. Проверь номер и настройки SMS-провайдера.");}
  finally{setAuthBusy(false);}
 };
 const verifyPhoneAuth=async()=>{
  setAuthMessage("");
  const number=phone.trim().replace(/[\\s()-]/g,"");
  const token=phoneOtp.trim();
  if(!/^\\d{6}$/.test(token)){setAuthMessage("Введи шестизначный код из SMS.");return;}
  setAuthBusy(true);
  try{const {error}=await supabase.auth.verifyOtp({phone:number,token,type:"sms"});if(error)throw error;}
  catch(error:any){setAuthMessage(error?.message||"Код неверный или устарел. Запроси новый SMS.");}
  finally{setAuthBusy(false);}
 };
 const signInSocial=async(provider:"custom:telegram",label:string)=>{
  setAuthMessage("");setAuthBusy(true);
  try{
   const redirectTo=Platform.OS==="web"?(typeof window!=="undefined"?new URL("/auth/social",window.location.origin).toString():undefined):"posidim://auth/social";
   const {data,error}=await supabase.auth.signInWithOAuth({provider:provider as any,options:{redirectTo,skipBrowserRedirect:Platform.OS!=="web"}});
   if(error)throw error;
   if(Platform.OS!=="web"&&data?.url)await Linking.openURL(data.url);
  }catch(error:any){setAuthMessage(error?.message||("Не удалось войти через "+label+". Проверь настройки провайдера в Supabase."));}
  finally{setAuthBusy(false);}
 };
 const visible = useMemo(()=>events.filter(e=>(filter==="Все"||e.category===filter)&&[e.title,e.place,e.description].some(v=>v.toLowerCase().includes(search.trim().toLowerCase()))),[events,filter,search]);
 const profileCompletionItems=[Boolean(name.trim()),Number.isInteger(Number(age))&&Number(age)>=18&&Number(age)<=120,Boolean(profileCity.trim()),Boolean(bio.trim()),Boolean(avatarUrl),profilePhotos.length>0];
 const profileCompletion=Math.round(profileCompletionItems.filter(Boolean).length/profileCompletionItems.length*100);
 const discoveryAgeRangeInvalid=(Number.parseInt(discoveryAgeMin,10)||18)>(Number.parseInt(discoveryAgeMax,10)||120);
 const ageFilteredProfiles=useMemo(()=>{const min=Number.parseInt(discoveryAgeMin,10)||18;const max=Number.parseInt(discoveryAgeMax,10)||120;const query=discoverySearch.trim().toLowerCase();if(discoveryAgeRangeInvalid)return [];return nearbyProfiles.filter(person=>{const ageMatches=Number(person.age)>=min&&Number(person.age)<=max;const searchMatches=!query||[person.display_name,person.city,person.bio,person.mood_status].filter(Boolean).join(" ").toLowerCase().includes(query);return ageMatches&&searchMatches;});},[nearbyProfiles,discoveryAgeMin,discoveryAgeMax,discoveryAgeRangeInvalid,discoverySearch]);
 const filteredDirectMessages=useMemo(()=>{const query=directMessageSearch.trim().toLowerCase();return query?directMessages.filter(message=>String(message.body||"").toLowerCase().includes(query)):directMessages;},[directMessages,directMessageSearch]);
 const filteredGroupMessages=useMemo(()=>{const query=groupMessageSearch.trim().toLowerCase();return query?chatMessages.filter(message=>String(message.body||"").toLowerCase().includes(query)):chatMessages;},[chatMessages,groupMessageSearch]);
 const filterLikePeople=(people:any[])=>{const query=likesSearch.trim().toLowerCase();return query?people.filter(person=>[person.display_name,person.city,person.bio].filter(Boolean).join(" ").toLowerCase().includes(query)):people;};
 const filteredMatches=useMemo(()=>filterLikePeople(matches),[matches,likesSearch]);
 const filteredIncomingLikes=useMemo(()=>filterLikePeople(incomingLikes),[incomingLikes,likesSearch]);
 const filteredMyLikes=useMemo(()=>filterLikePeople(myLikes),[myLikes,likesSearch]);
 const filteredDirectConversations=useMemo(()=>{const query=directSearch.trim().toLowerCase();if(!query)return directConversations;return directConversations.filter(conv=>[conv.person?.display_name,conv.person?.city,conv.lastMessage?.body].filter(Boolean).join(" ").toLowerCase().includes(query));},[directConversations,directSearch]);
 const startEditingEvent=(ev:EventItem)=>{
  const scheduled=new Date(ev.startsAt||"");
  if(Number.isNaN(scheduled.getTime())){Alert.alert("Не удалось открыть встречу","Не получилось прочитать дату встречи.");return;}
  setEditingEvent(ev);setTitle(ev.title);setCategory(ev.category);setPlace(ev.place);setDescription(ev.description||"");setCapacity(ev.capacity);
  setEventDate(formatDateInput(scheduled));setEventTime(formatTimeInput(scheduled));setCreateOpen(true);
 };
 const cancelHostedEvent=(ev:EventItem)=>{
  Alert.alert("Отменить встречу?","Встреча исчезнет из поиска. Уже принятые участники сохранят доступ к общему чату.",[
   {text:"Не отменять",style:"cancel"},
   {text:"Отменить встречу",style:"destructive",onPress:()=>{
    void (async()=>{
     try{
      const {data,error}=await supabase.from("events").update({status:"cancelled"}).eq("id",ev.id).eq("host_id",session.user.id).eq("status","open").select("id,status").maybeSingle();
      if(error)throw error;
      if(!data)throw new Error("Встреча уже отменена или недоступна.");
      const notice="Организатор отменил встречу. История чата сохранена.";
      const {error:noticeError}=await supabase.from("messages").insert({event_id:ev.id,sender_id:session.user.id,body:notice});
      if(noticeError)console.warn("Не удалось добавить уведомление об отмене в чат:",noticeError.message);
      const {data:members,error:membersError}=await supabase.from("event_members").select("user_id").eq("event_id",ev.id).eq("status","accepted");
      if(membersError)console.warn("Не удалось загрузить участников для уведомления:",membersError.message);
      else for(const member of members||[])void supabase.functions.invoke("send-notification",{body:{recipientId:member.user_id,kind:"event_cancelled",refId:ev.id,title:"Встреча отменена",body:"Организатор отменил встречу. Открой чат, чтобы увидеть подробности."}}).catch((notificationError:any)=>console.warn("Не удалось отправить push об отмене:",notificationError?.message||notificationError));
      setEvents(items=>items.filter(item=>item.id!==ev.id));
      setGroupEvents(items=>items.map(item=>item.id===ev.id?{...item,status:"cancelled"}:item));
      Alert.alert("Встреча отменена","Она больше не показывается в поиске.");
     }catch(e:any){Alert.alert("Не удалось отменить встречу",e?.message||"Попробуй ещё раз.");}
    })();
   }}
  ]);
 };
 const closeCreateModal=()=>{
  setCreateOpen(false);setEditingEvent(null);setTitle("");setPlace("");setDescription("");setCategory("Общение");setCapacity(6);
  const nextEventStart=new Date(Date.now()+60*60*1000);setEventDate(formatDateInput(nextEventStart));setEventTime(formatTimeInput(nextEventStart));
 };
 const create = async () => {
  if(!title.trim()||!place.trim()){Alert.alert("Заполни обязательные поля","Нужно указать название и место встречи.");return;}
  const dateParts=eventDate.trim().split("-");
  const timeParts=eventTime.trim().split(":");
  if(dateParts.length!==3||dateParts[0].length!==4||dateParts[1].length!==2||dateParts[2].length!==2||timeParts.length!==2||timeParts[0].length!==2||timeParts[1].length!==2||[...dateParts,...timeParts].some(part=>part.trim()===""||!Number.isInteger(Number(part)))){Alert.alert("Проверь дату и время","Укажи дату в формате ГГГГ-ММ-ДД, а время — ЧЧ:ММ.");return;}
  const [year,month,day]=dateParts.map(Number);
  const [hour,minute]=timeParts.map(Number);
  const startsAt=new Date(year,month-1,day,hour,minute);
  if(year<1000||Number.isNaN(startsAt.getTime())||startsAt.getFullYear()!==year||startsAt.getMonth()!==month-1||startsAt.getDate()!==day||startsAt.getHours()!==hour||startsAt.getMinutes()!==minute||startsAt.getTime()<=Date.now()){Alert.alert("Неверная дата или время","Выбери существующие дату и время в будущем.");return;}
  const city=profileCity||session?.user?.user_metadata?.city||"";
  if(!city){Alert.alert("Укажи город","Город нужен, чтобы встречу увидели люди рядом.");return;}
  setChatBusy(true);
  try{
   if(editingEvent){
    const {count,error:countError}=await supabase.from("event_members").select("user_id",{count:"exact",head:true}).eq("event_id",editingEvent.id).eq("status","accepted");
    if(countError)throw countError;
    if(capacity<(count||0)+1){Alert.alert("Слишком маленькая вместимость","В этой встрече уже есть "+((count||0)+1)+" участников вместе с организатором.");return;}
    const {data:updated,error}=await supabase.from("events").update({title:title.trim(),category,description:description.trim()||"Новая встреча в ПОСИДИМ. Присоединяйся!",city,venue:place.trim(),starts_at:startsAt.toISOString(),capacity}).eq("id",editingEvent.id).eq("host_id",session.user.id).eq("status","open").select("id,title,category,venue,capacity").single();
    if(error)throw error;
    setGroupEvents(items=>items.map(item=>item.id===updated.id?{...item,...updated}:item));
    setCreateOpen(false);setEditingEvent(null);setTitle("");setPlace("");setDescription("");
    const nextEventStart=new Date(Date.now()+60*60*1000);setEventDate(formatDateInput(nextEventStart));setEventTime(formatTimeInput(nextEventStart));
    setFilter("Все");setSearch("");await loadEvents();
    Alert.alert("Встреча обновлена","Изменения сохранены.");
   }else{
    const {data:created,error}=await supabase.from("events").insert({host_id:session.user.id,title:title.trim(),category,description:description.trim()||"Новая встреча в ПОСИДИМ. Присоединяйся!",city,venue:place.trim(),starts_at:startsAt.toISOString(),capacity,status:"open"}).select("id,title,category,venue,capacity").single();
    if(error)throw error;
    setGroupEvents(items=>[created,...items.filter(x=>x.id!==created.id)]);
    setCreateOpen(false);setTitle("");setPlace("");setDescription("");
    const nextEventStart=new Date(Date.now()+60*60*1000);setEventDate(formatDateInput(nextEventStart));setEventTime(formatTimeInput(nextEventStart));
    setFilter("Все");setSearch("");setTab("Карта");await loadEvents();
    Alert.alert("Встреча опубликована","Она сохранена в базе и доступна пользователям твоего города.");
   }
  }catch(e:any){Alert.alert(editingEvent?"Не удалось обновить встречу":"Не удалось опубликовать встречу",e?.message||"Проверь подключение к Supabase.");}
  finally{setChatBusy(false);}
 };
 const selectInterestPreset=(preset:string)=>{setMood(preset);setQuickActivity(INTEREST_TO_ACTIVITY[preset]||"Общение");};
 const selectQuickActivity=(activity:string)=>{setQuickActivity(activity);const preset=Object.entries(INTEREST_TO_ACTIVITY).find(([,value])=>value===activity)?.[0];if(preset)setMood(preset);};
 const createQuick = async () => {
  const city=profileCity||session?.user?.user_metadata?.city||"";
  if(!city){Alert.alert("Укажи город","Город нужен, чтобы предложение увидели другие пользователи.");return;}
  const cat=quickActivity==="Кофе"?"Кофе":quickActivity==="Прогулка"?"Прогулка":quickActivity==="Кино"?"Кино":quickActivity==="Спорт"?"Спорт":quickActivity==="Настольные игры"?"Настолки":quickActivity==="Развлечься"?"Другое":"Общение";
  const delayMinutes=quickTime.includes("20")?20:quickTime.includes("30")?30:quickTime.includes("2 часа")?120:60;
  setChatBusy(true);
  try{const {data:created,error}=await supabase.from("events").insert({host_id:session.user.id,title:quickActivity+" · спонтанно",category:cat,description:"Быстрая встреча ("+quickTime+"). Детали обсудим вместе!",city,venue:"Место договоримся в чате",starts_at:new Date(Date.now()+delayMinutes*60*1000).toISOString(),capacity:5,status:"open"}).select("id,title,category,venue,capacity").single();if(error)throw error;setGroupEvents(items=>[created,...items.filter(x=>x.id!==created.id)]);setQuickOpen(false);setFilter("Все");setSearch("");setTab("Карта");await loadEvents();Alert.alert("Предложение опубликовано","Оно сохранено и доступно пользователям твоего города.");}catch(e:any){Alert.alert("Не удалось опубликовать предложение",e?.message||"Проверь подключение к Supabase.");}finally{setChatBusy(false);}
 };
 const join = async (id:number|string) => {
  if(!session?.user?.id)return;
  const currentStatus=eventMemberships[String(id)];
  if(currentStatus){Alert.alert("Статус заявки",currentStatus==="accepted"?"Ты уже участник этой встречи.":currentStatus==="requested"?"Заявка уже отправлена.":currentStatus==="declined"?"Организатор отклонил заявку.":"Ты уже выходил(а) из этой встречи.");return;}
  try{
   const {data:event,error:eventError}=await supabase.from("events").select("id,starts_at,status").eq("id",id).maybeSingle();
   if(eventError)throw eventError;
   if(!event||event.status!=="open"||new Date(event.starts_at).getTime()<=Date.now()){Alert.alert("Встреча уже недоступна","Выбери встречу, которая ещё не началась.");return;}
   const {error}=await supabase.from("event_members").insert({event_id:id,user_id:session.user.id,status:"requested"});
   if(error)throw error;
   setEventMemberships(current=>({...current,[String(id)]:"requested"}));
   Alert.alert("Запрос отправлен","Организатор увидит твою заявку.");
  }catch(e:any){
   const {data}=await supabase.from("event_members").select("status").eq("event_id",id).eq("user_id",session.user.id).maybeSingle();
   if(data?.status)setEventMemberships(current=>({...current,[String(id)]:data.status}));
   Alert.alert("Не удалось отправить запрос",data?.status==="requested"?"Заявка уже отправлена.":e?.message||"Проверь подключение и повтори попытку.");
  }
 };
 const openEventRequests=async(ev:any)=>{
  setManagedEvent(ev);setPendingEventRequests([]);setRequestsBusy(true);
  try{
   const {data,error}=await supabase.from("event_members").select("user_id,created_at").eq("event_id",ev.id).eq("status","requested").order("created_at",{ascending:true});
   if(error)throw error;
   const requests=data||[];
   if(!requests.length){setPendingEventRequests([]);return;}
   const ids=requests.map((x:any)=>x.user_id);
   const {data:people,error:peopleError}=await supabase.from("profiles").select("id,display_name,age,city,avatar_url").in("id",ids);
   if(peopleError)throw peopleError;
   const byId=new Map((people||[]).map((person:any)=>[person.id,person]));
   setPendingEventRequests(requests.map((request:any)=>({...request,person:byId.get(request.user_id)})).filter((request:any)=>request.person));
  }catch(e:any){Alert.alert("Не удалось загрузить заявки",e?.message||"Попробуй обновить список.");}
  finally{setRequestsBusy(false);}
 };
 const reviewEventRequest=async(request:any,accept:boolean)=>{
  if(!managedEvent?.id||!session?.user?.id)return;
  setRequestActionBusy(request.user_id);
  try{
   if(accept){
    const {count,error:countError}=await supabase.from("event_members").select("user_id",{count:"exact",head:true}).eq("event_id",managedEvent.id).eq("status","accepted");
    if(countError)throw countError;
    if((count||0)+1>=Number(managedEvent.capacity)){Alert.alert("Свободных мест нет","Встреча уже заполнена. Увеличь вместимость или отклони заявку.");return;}
   }
   const {data,error}=await supabase.from("event_members").update({status:accept?"accepted":"declined"}).eq("event_id",managedEvent.id).eq("user_id",request.user_id).eq("status","requested").select("user_id").maybeSingle();
   if(error)throw error;
   if(!data)throw new Error("Эта заявка уже обработана. Обнови список.");
   setPendingEventRequests(items=>items.filter(item=>item.user_id!==request.user_id));
   setEvents(items=>items.map(item=>item.id===managedEvent.id?{...item,pendingRequests:Math.max(0,(item.pendingRequests||0)-1)}:item));
   if(accept)setGroupEvents(items=>items.some(item=>item.id===managedEvent.id)?items:[{id:managedEvent.id,title:managedEvent.title,category:managedEvent.category,venue:managedEvent.place||managedEvent.venue,capacity:managedEvent.capacity},...items]);
  }catch(e:any){Alert.alert("Не удалось обработать заявку",e?.message||"Попробуй ещё раз.");}
  finally{setRequestActionBusy(null);}
 };
 const swipeResponder=useMemo(()=>PanResponder.create({onMoveShouldSetPanResponder:(_evt,gesture)=>Math.abs(gesture.dx)>14,onPanResponderRelease:(_evt,gesture)=>{const person=ageFilteredProfiles[0];if(!person)return;if(gesture.dx>75)rateProfile(person.id,true);else if(gesture.dx< -75)rateProfile(person.id,false);}}),[ageFilteredProfiles]);
 const nav = (item:string) => setTab(item);
 if(authLoading) return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content"/><View style={s.authWrap}><Text style={s.logo}>ПОСИДИМ<Text style={{color:"#A78BFA"}}>.</Text></Text><Text style={s.muted}>Проверяем вход...</Text></View></SafeAreaView>;
 if(!session) return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content"/><ScrollView contentContainerStyle={s.authWrap} keyboardShouldPersistTaps="handled"><Text style={s.logo}>ПОСИДИМ<Text style={{color:"#A78BFA"}}>.</Text></Text><Text style={s.heroTitle}>{authMode==="signup"?"Знакомства начинаются здесь":"С возвращением!"}</Text><Text style={[s.muted,{marginBottom:18}]}>{authMode==="signup"?"Создай аккаунт, чтобы находить людей и встречи рядом.":"Войди, чтобы продолжить общение и находить встречи."}</Text>
 {authMode==="signup"&&<><Text style={s.label}>Имя</Text><TextInput value={authName} onChangeText={setAuthName} style={s.input} placeholder="Как тебя зовут?" placeholderTextColor="#777D8C"/><Text style={s.label}>Возраст (18+)</Text><TextInput value={authAge} onChangeText={setAuthAge} keyboardType="number-pad" style={s.input} placeholder="Возраст" placeholderTextColor="#777D8C"/><Text style={s.label}>Город</Text><TextInput value={authCity} onChangeText={setAuthCity} style={s.input} placeholder="Твой город" placeholderTextColor="#777D8C"/></>}
 <View style={{flexDirection:"row",gap:9,marginTop:8}}>
  <TouchableOpacity onPress={()=>{setAuthChannel("email");setPhoneOtpSent(false);setAuthMessage("");}} style={[s.chip,{flex:1,alignItems:"center",backgroundColor:authChannel==="email"?"#A78BFA":"#20232D"}]}><Text style={{color:authChannel==="email"?"#191426":"#D2C7FF",fontWeight:"800"}}>Email</Text></TouchableOpacity>
  <TouchableOpacity onPress={()=>{setAuthChannel("phone");setAuthMessage("");}} style={[s.chip,{flex:1,alignItems:"center",backgroundColor:authChannel==="phone"?"#A78BFA":"#20232D"}]}><Text style={{color:authChannel==="phone"?"#191426":"#D2C7FF",fontWeight:"800"}}>Телефон</Text></TouchableOpacity>
 </View>
 {authChannel==="email"?<>
  <Text style={s.label}>Электронная почта</Text><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={s.input} placeholder="name@example.com" placeholderTextColor="#777D8C"/><Text style={s.label}>Пароль</Text><TextInput value={password} onChangeText={setPassword} secureTextEntry style={s.input} placeholder="Минимум 6 символов" placeholderTextColor="#777D8C"/>
  <TouchableOpacity disabled={authBusy} onPress={handleAuth} style={[s.button,{marginTop:20,opacity:authBusy?0.6:1}]}><Text style={s.buttonText}>{authBusy?"Подожди...":authMode==="signup"?"Создать аккаунт":"Войти"}</Text></TouchableOpacity>
  {authMode==="login"&&<TouchableOpacity disabled={resetBusy||authBusy} onPress={()=>void resetPasswordEmail()} style={{padding:12,alignItems:"center",opacity:resetBusy?0.6:1}}><Text style={s.purple}>{resetBusy?"Отправляем письмо...":"Забыли пароль?"}</Text></TouchableOpacity>}
 </>:<>
  <Text style={s.label}>Номер телефона</Text><TextInput value={phone} onChangeText={value=>{setPhone(value);setPhoneOtpSent(false);}} autoCapitalize="none" keyboardType="phone-pad" style={s.input} placeholder="+37255555555" placeholderTextColor="#777D8C" editable={!phoneOtpSent}/>
  {phoneOtpSent&&<><Text style={s.label}>Код из SMS</Text><TextInput value={phoneOtp} onChangeText={setPhoneOtp} keyboardType="number-pad" maxLength={6} style={s.input} placeholder="123456" placeholderTextColor="#777D8C"/></>}
  <TouchableOpacity disabled={authBusy} onPress={()=>void(phoneOtpSent?verifyPhoneAuth():startPhoneAuth())} style={[s.button,{marginTop:20,opacity:authBusy?0.6:1}]}><Text style={s.buttonText}>{authBusy?"Подожди...":phoneOtpSent?"Подтвердить код":"Получить SMS-код"}</Text></TouchableOpacity>
  {phoneOtpSent&&<TouchableOpacity disabled={authBusy} onPress={()=>{setPhoneOtpSent(false);setPhoneOtp("");setAuthMessage("");}} style={{padding:10,alignItems:"center"}}><Text style={s.purple}>Изменить номер</Text></TouchableOpacity>}
 </>}
 {authMessage!==""&&<Text style={s.authMessage}>{authMessage}</Text>}
 <View style={{marginTop:20,borderTopWidth:1,borderTopColor:"#292E39",paddingTop:16}}>
  <Text style={[s.muted,{textAlign:"center",marginBottom:4}]}>Или продолжи через</Text>
  <TouchableOpacity disabled={true} style={[s.button,s.secondary,{marginTop:10,opacity:0.48}]}><Text style={s.secondaryText}>VK ID — скоро</Text></TouchableOpacity>
  <TouchableOpacity disabled={authBusy} onPress={()=>void signInSocial("custom:telegram","Telegram")} style={[s.button,s.secondary,{marginTop:9,opacity:authBusy?0.6:1}]}><Text style={s.secondaryText}>Войти через Telegram</Text></TouchableOpacity>
 </View>
 <TouchableOpacity onPress={()=>{setAuthMode(authMode==="signup"?"login":"signup");setPhoneOtpSent(false);setPhoneOtp("");setAuthMessage("");}} style={{padding:16,alignItems:"center"}}><Text style={s.purple}>{authMode==="signup"?"Уже есть аккаунт? Войти":"Нет аккаунта? Зарегистрироваться"}</Text></TouchableOpacity>
 <Text style={s.note}>Продолжая, ты подтверждаешь, что тебе исполнилось 18 лет. Для SMS и входа через соцсети требуются включённые провайдеры и проверенные настройки безопасности.</Text>
 </ScrollView></SafeAreaView>;
 const Header=()=> <View style={s.top}><View><Text style={s.logo}>ПОСИДИМ<Text style={{color:"#A78BFA"}}>.</Text></Text><Text style={s.muted}>Люди рядом. Встречи по душе.</Text></View><View style={s.avatar}>{avatarUrl?<Image source={{uri:avatarUrl}} style={s.avatarImage}/>:<Text style={s.purple}>{name.slice(0,1).toUpperCase()||"Я"}</Text>}</View></View>;
 const Button=({label,onPress,secondary=false,disabled=false}:{label:string;onPress:()=>void;secondary?:boolean;disabled?:boolean})=><TouchableOpacity disabled={disabled} onPress={onPress} style={[s.button,secondary&&s.secondary,disabled&&{opacity:0.48}]}><Text style={[s.buttonText,secondary&&s.secondaryText]}>{label}</Text></TouchableOpacity>;
 return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content"/><View style={s.page}><ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}><Header/>
 {tab==="Главная"&&<><View style={s.hero}><Text style={s.eyebrow}>ТВОЙ ГОРОД, ТВОЯ КОМПАНИЯ</Text><Text style={s.heroTitle}>Не сиди один. Посидим?</Text><Text style={s.muted}>Находи людей, собирай компанию и проводи время так, как нравится тебе.</Text></View><View style={s.quickHero}><View style={s.rowBetween}><View style={{flex:1}}><Text style={s.eyebrow}>БЕЗ ДОЛГИХ ПЛАНОВ</Text><Text style={s.cardTitle}>Хочешь куда-нибудь прямо сейчас?</Text><Text style={s.muted}>Создай предложение за пару нажатий.</Text></View><Text style={{fontSize:30}}>⚡</Text></View><Button label="Спонтанно — найти компанию" onPress={()=>setQuickOpen(true)}/></View><Text style={s.heading}>Быстрый выбор</Text><View style={s.quickGrid}>{[{e:"☕",t:"Кофе"},{e:"🚶",t:"Прогулка"},{e:"🎬",t:"Кино"},{e:"🎲",t:"Настольные игры"},{e:"💬",t:"Общение"},{e:"🎉",t:"Развлечься"}].map(a=><TouchableOpacity key={a.t} style={s.quickTile} onPress={()=>{setQuickActivity(a.t);setQuickOpen(true);}}><Text style={{fontSize:23}}>{a.e}</Text><Text style={s.quickTileText}>{a.t}</Text></TouchableOpacity>)}</View><View style={s.card}><Text style={s.cardTitle}>Ищи компанию на карте</Text><Text style={s.muted}>Открывай раздел «Карта», чтобы посмотреть людей и встречи в выбранном районе.</Text><Button label="Открыть карту" onPress={()=>setTab("Карта")}/></View><View style={s.rowBetween}><Text style={s.heading}>Куда сегодня?</Text><Text style={s.purple}>{visible.length} рядом</Text></View><TextInput value={search} onChangeText={setSearch} placeholder="Поиск по встречам и местам" placeholderTextColor="#777D8C" style={s.input}/><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>{FILTERS.map(x=><TouchableOpacity key={x} onPress={()=>setFilter(x)} style={[s.chip,filter===x&&s.chipOn]}><Text style={{color:filter===x?"#171322":"#B7BBC5"}}>{x}</Text></TouchableOpacity>)}</ScrollView>{visible.length===0?<Text style={s.empty}>Ничего не найдено. Попробуй другой запрос.</Text>:visible.map(e=>{const membership=eventMemberships[String(e.id)]||"";return <View key={e.id} style={s.card}><View style={s.rowBetween}><Text style={s.purple}>{e.host} · {e.category}</Text><Text style={s.muted}>{e.time}</Text></View><Text style={s.cardTitle}>{e.title}</Text><Text style={s.muted}>{e.description}</Text><Text style={s.meta}>⌖  {e.place}</Text><TouchableOpacity onPress={()=>reportEvent(e)} style={{alignSelf:"flex-start",paddingVertical:6}}><Text style={s.note}>Пожаловаться на встречу</Text></TouchableOpacity>{e.host_id===session.user.id&&<><Button label="Позвать людей" secondary onPress={()=>openInvitePicker({id:e.id,title:e.title,capacity:e.capacity})}/><Button label="Изменить встречу" secondary onPress={()=>startEditingEvent(e)}/><Button label="Отменить встречу" secondary onPress={()=>cancelHostedEvent(e)}/></>}<View style={s.rowBetween}><Text style={s.muted}>До {e.capacity} участников</Text>{e.host_id===session.user.id?<Button label={"Заявки · "+(e.pendingRequests||0)} secondary onPress={()=>openEventRequests(e)}/>:<Button label={membership==="accepted"?"Ты участник":membership==="requested"?"Заявка отправлена":membership==="declined"?"Заявка отклонена":membership==="left"?"Ты покинул встречу":"Хочу пойти"} secondary onPress={()=>join(e.id)} disabled={!!membership}/>}</View></View>})}</>}
 {tab==="Карта"&&<><Text style={s.heading}>Карта рядом</Text><Text style={s.muted}>Настоящая карта города на основе OpenStreetMap. Точное местоположение пользователей здесь не отображается.</Text><View style={s.card}><View style={s.rowBetween}><View style={{flex:1}}><Text style={s.eyebrow}>ТВОЯ ВИДИМОСТЬ</Text><Text style={s.cardTitle}>Показывать меня на карте</Text></View><TouchableOpacity onPress={toggleDiscoverability} style={[s.visibilityToggle,mapVisible&&s.visibilityToggleOn]}><Text style={s.visibilityToggleText}>{mapVisible?"ВКЛ":"ВЫКЛ"}</Text></TouchableOpacity></View><Text style={s.muted}>{mapVisible?"Твой профиль доступен в поиске рядом.":"Ты скрыт(а) из поиска людей. В любой момент можно включить видимость."}</Text><View style={{marginTop:12}}><Button label={locationBusy?"Определяем местоположение...":locationSharing?"Выключить точный геопоиск":"Включить поиск людей по радиусу"} secondary onPress={locationSharing?disableLocationSharing:enableLocationSharing}/></View><Text style={s.note}>Геолокация включается только после твоего нажатия. Координаты хранятся отдельно и не доступны другим пользователям напрямую; на карту выдаётся смещённая точка.</Text></View><View style={s.mapPreview}><View style={s.rowBetween}><Text style={s.cardTitle}>Карта города</Text><TouchableOpacity onPress={()=>{loadNearby();loadEvents();}}><Text style={s.purple}>Обновить ↻</Text></TouchableOpacity></View><View style={s.realMap}><MapSurface city={profileCity||session?.user?.user_metadata?.city||authCity||""} radius={radius} events={events} people={ageFilteredProfiles} userLocation={locationSharing&&ownLocation?{latitude:Math.round(ownLocation.latitude*100)/100,longitude:Math.round(ownLocation.longitude*100)/100}:null}/></View><Text style={s.note}>Карта бесплатна для прототипа. Данные © OpenStreetMap contributors. При большом количестве пользователей для стабильной работы понадобится отдельный поставщик карт.</Text><Text style={s.label}>Радиус области</Text><View style={s.filters}>{["5 км","10 км","15 км","20 км","30 км","40 км"].map(x=><TouchableOpacity key={x} onPress={()=>setRadius(x)} style={[s.chip,radius===x&&s.chipOn]}><Text style={{color:radius===x?"#171322":"#B7BBC5"}}>{x}</Text></TouchableOpacity>)}</View><Text style={s.purple}>Выбранная область: {radius}</Text></View><View style={s.card}><View style={s.rowBetween}><Text style={s.cardTitle}>Люди рядом · {ageFilteredProfiles.length}</Text><Text style={s.purple}>фильтр возраста</Text></View><Text style={s.muted}>{locationSharing?"Показываем людей в выбранном радиусе по приблизительным координатам. Точная геопозиция никому не раскрывается.":"Пока поиск работает по указанному городу. Включи геопоиск выше, чтобы искать людей по радиусу."} Свайпни карточку влево, чтобы пропустить, или вправо, чтобы поставить лайк.</Text><View style={{flexDirection:"row",gap:10,alignItems:"flex-end",marginTop:12}}><View style={{flex:1}}><Text style={s.label}>Возраст от</Text><TextInput value={discoveryAgeMin} onChangeText={value=>setDiscoveryAgeMin(value.replace(/[^0-9]/g,"").slice(0,3))} keyboardType="number-pad" maxLength={3} style={s.input} placeholder="18" placeholderTextColor="#777D8C"/></View><View style={{flex:1}}><Text style={s.label}>Возраст до</Text><TextInput value={discoveryAgeMax} onChangeText={value=>setDiscoveryAgeMax(value.replace(/[^0-9]/g,"").slice(0,3))} keyboardType="number-pad" maxLength={3} style={s.input} placeholder="120" placeholderTextColor="#777D8C"/></View><Button label="Сбросить" secondary onPress={()=>{setDiscoveryAgeMin("18");setDiscoveryAgeMax("120");setDiscoverySearch("");}}/></View><Text style={s.label}>Поиск по людям и интересам</Text><TextInput value={discoverySearch} onChangeText={setDiscoverySearch} style={s.input} placeholder="Имя, город, описание или интерес..." placeholderTextColor="#777D8C"/>{discoveryLoading?<Text style={s.empty}>Ищем людей...</Text>:discoveryAgeRangeInvalid?<Text style={s.empty}>Минимальный возраст не может быть больше максимального.</Text>:ageFilteredProfiles.length===0?<Text style={s.empty}>{nearbyProfiles.length===0?"Пока никого не нашли. Позови друзей или проверь, включили ли другие пользователи видимость в своём профиле.":discoverySearch.trim()?"По этому запросу профилей не найдено. Попробуй другие слова.":"Нет профилей в выбранном диапазоне возраста."}</Text>:<View style={s.personCard} {...swipeResponder.panHandlers}>{ageFilteredProfiles.slice(0,6).map((person:any,index:number)=><View key={person.id} style={{display:index===0?"flex":"none"}}><View style={s.personAvatar}>{person.avatar_url?<Image source={{uri:person.avatar_url}} style={s.personAvatarImage}/>:<Text style={s.personAvatarLetter}>{(person.display_name||"?").slice(0,1).toUpperCase()}</Text>}</View><Text style={s.cardTitle}>{person.display_name}, {person.age}</Text><Text style={s.muted}>{person.bio||"Пока ничего не рассказал(а) о себе."}</Text><Button label="Посмотреть профиль" onPress={()=>openPublicProfile(person)} secondary/><Text style={s.meta}>{person.distance_km!=null?`Примерно ${Math.round(Number(person.distance_km)*2)/2} км от тебя`:person.city+" · профиль рядом по городу"}</Text><View style={s.rowBetween}><TouchableOpacity style={[s.swipeButton,s.skipButton]} onPress={()=>rateProfile(person.id,false)}><Text style={s.skipText}>← Пропустить</Text></TouchableOpacity><TouchableOpacity style={[s.swipeButton,s.likeButton]} onPress={()=>rateProfile(person.id,true)}><Text style={s.likeText}>Нравится →</Text></TouchableOpacity></View><Text style={s.note}>Карточка 1 из {Math.min(ageFilteredProfiles.length,6)} в текущей подборке</Text></View>)}</View>}</View><View style={s.card}><Text style={s.cardTitle}>Встречи на карте</Text>{events.length===0?<Text style={s.empty}>Пока встреч нет. Создай первую — она появится в списке и на карте, если место удастся определить.</Text>:events.map(e=><View key={e.id} style={{paddingVertical:10,borderBottomWidth:1,borderBottomColor:"#303541"}}><Text style={s.cardTitle}>{e.title}</Text><Text style={s.muted}>{e.category} · {e.place}</Text><Text style={s.purple}>{e.time} · до {e.capacity} человек</Text>{e.host_id===session.user.id&&<Button label="Позвать понравившихся" secondary onPress={()=>openInvitePicker(e)}/>}</View>)}<Button label="＋ Создать встречу" onPress={()=>setCreateOpen(true)}/></View><View style={s.card}><Text style={s.cardTitle}>Ищи компанию по интересам</Text><Text style={s.muted}>Выбирай занятия и встречи, а не просто ближайшие координаты людей.</Text><View style={s.filters}>{["☕ Хочу кофе","🚶 Хочу гулять","🎲 Настолки","💬 Открыт к общению","🎉 Развлечься"].map(x=><TouchableOpacity key={x} onPress={()=>selectInterestPreset(x)} style={[s.chip,mood===x&&s.chipOn]}><Text style={{color:mood===x?"#171322":"#B7BBC5"}}>{x}</Text></TouchableOpacity>)}</View><Text style={s.purple}>Выбранный интерес: {mood} · для встречи: {quickActivity}</Text><Button label="⚡ Создать спонтанную встречу" onPress={()=>setQuickOpen(true)}/></View></>}{tab==="Симпатии"&&<><Text style={s.heading}>Симпатии</Text><Text style={s.muted}>Здесь собраны взаимные совпадения, люди, которым ты понравился(ась), и профили, которые отметил(а) ты.</Text><TextInput value={likesSearch} onChangeText={setLikesSearch} style={s.input} placeholder="Найти человека по имени или городу..." placeholderTextColor="#777D8C"/><View style={s.card}><View style={s.rowBetween}><Text style={s.cardTitle}>Совпадения · {matches.length}</Text><TouchableOpacity onPress={loadLikes}><Text style={s.purple}>Обновить ↻</Text></TouchableOpacity></View>{likesBusy?<Text style={s.empty}>Загружаем...</Text>:matches.length===0?<Text style={s.muted}>Пока нет совпадений. Продолжай знакомиться на карте — взаимные лайки появятся здесь.</Text>:filteredMatches.length===0?<Text style={s.empty}>По этому запросу совпадений нет.</Text>:filteredMatches.map(p=><View key={p.id} style={s.rowBetween}><TouchableOpacity style={{flex:1}} onPress={()=>openPublicProfile(p)}><Text style={s.messageText}>{p.display_name}, {p.age}</Text><Text style={s.muted}>{p.city||""} · взаимная симпатия 💜</Text></TouchableOpacity><Button label="Профиль" secondary onPress={()=>openPublicProfile(p)}/><Button label="Написать" onPress={()=>openDirectChat(p)}/></View>)}</View><View style={s.card}><Text style={s.cardTitle}>Тебе симпатизируют · {incomingLikes.length}</Text>{incomingLikes.length===0?<Text style={s.muted}>Пока новых симпатий нет. Когда кто-то поставит тебе лайк, он появится здесь.</Text>:filteredIncomingLikes.length===0?<Text style={s.empty}>По этому запросу людей не найдено.</Text>:filteredIncomingLikes.map(p=><View key={p.id} style={s.rowBetween}><TouchableOpacity style={{flex:1}} onPress={()=>openPublicProfile(p)}><Text style={s.messageText}>{p.display_name}, {p.age}</Text><Text style={s.muted}>{p.city||""}</Text></TouchableOpacity><Button label="Ответить лайком" onPress={()=>rateProfile(p.id,true)}/></View>)}</View><View style={s.card}><Text style={s.cardTitle}>Мои симпатии · {myLikes.length}</Text>{myLikes.length===0?<Text style={s.muted}>Профили, которым ты поставил(а) лайк, появятся здесь.</Text>:filteredMyLikes.length===0?<Text style={s.empty}>По этому запросу людей не найдено.</Text>:filteredMyLikes.map(p=><View key={p.id} style={s.rowBetween}><TouchableOpacity style={{flex:1}} onPress={()=>openPublicProfile(p)}><Text style={s.messageText}>{p.display_name}, {p.age}</Text><Text style={s.muted}>{p.city||""}</Text></TouchableOpacity><Button label="Отменить лайк" secondary onPress={()=>rateProfile(p.id,false)}/></View>)}</View></>}{tab==="Чаты"&&<><Text style={s.heading}>Сообщения</Text>{activeDirectChat?<View style={s.card}><View style={s.rowBetween}><Text style={s.cardTitle}>{activeDirectChat.person.display_name}</Text><TouchableOpacity onPress={()=>{setActiveDirectChat(null);loadDirectConversations();}}><Text style={s.purple}>К списку</Text></TouchableOpacity></View><Text style={s.muted}>Личная переписка · только для вас двоих. Удерживай чужое сообщение, чтобы пожаловаться.</Text><View style={[s.rowBetween,{marginTop:10,marginBottom:4}]}><Button label="Пожаловаться" secondary onPress={()=>reportViewedProfile(activeDirectChat.person)}/><Button label="Заблокировать" secondary onPress={()=>blockViewedProfile(activeDirectChat.person)}/></View><TextInput value={directMessageSearch} onChangeText={setDirectMessageSearch} style={s.input} placeholder="Поиск в загруженной истории..." placeholderTextColor="#777D8C"/><View style={{maxHeight:330,marginTop:10}}><ScrollView nestedScrollEnabled>{directHasMore&&<Button label={directLoadingOlder?"Загружаем...":"Загрузить ранние сообщения"} secondary onPress={loadOlderDirectMessages} disabled={directLoadingOlder}/>}{filteredDirectMessages.map(m=><TouchableOpacity key={m.id} activeOpacity={1} onLongPress={()=>reportChatMessage(m)} style={[s.messageBubble,m.sender_id===session.user.id&&s.messageMine]}><Text style={s.messageText}>{m.body}</Text><Text style={s.messageTime}>{new Date(m.created_at).toLocaleString()}</Text></TouchableOpacity>)}{directMessages.length===0?<Text style={s.empty}>Начни разговор — напиши первое сообщение.</Text>:filteredDirectMessages.length===0?<Text style={s.empty}>В загруженной истории таких сообщений нет.</Text>:null}</ScrollView></View><TouchableOpacity onPress={()=>setDirectDraft(ICEBREAKERS[Math.floor(Math.random()*ICEBREAKERS.length)])} style={[s.chip,{alignSelf:"flex-start",marginTop:10,marginBottom:8}]}><Text style={s.purple}>✨ Подсказать тему для разговора</Text></TouchableOpacity><TextInput value={directDraft} onChangeText={setDirectDraft} style={s.input} maxLength={2000} placeholder="Напиши личное сообщение..." placeholderTextColor="#777D8C"/><Text style={s.note}>{directDraft.length}/2000 · Черновик сохраняется на этом устройстве.</Text><Button label={directBusy?"Отправляем...":"Отправить"} disabled={directBusy||!directDraft.trim()} onPress={sendDirectMessage}/></View>:<><Text style={s.cardTitle}>Личные чаты · {directConversations.length}</Text><TextInput value={directSearch} onChangeText={setDirectSearch} style={s.input} placeholder="Найти чат по имени или сообщению..." placeholderTextColor="#777D8C"/>{directConversations.length===0?<Text style={s.muted}>После взаимной симпатии здесь появится возможность начать личный разговор.</Text>:filteredDirectConversations.length===0?<Text style={s.empty}>По этому запросу чатов не найдено.</Text>:filteredDirectConversations.map(conv=><TouchableOpacity key={conv.id} style={s.card} onPress={()=>{setActiveChat(null);setActiveDirectChat({id:conv.id,person:conv.person});}}><View style={s.rowBetween}><Text style={s.cardTitle}>{conv.person.display_name}, {conv.person.age}</Text><Text style={s.muted}>{new Date(conv.lastMessage?.created_at||conv.updated_at).toLocaleDateString()===new Date().toLocaleDateString()?new Date(conv.lastMessage?.created_at||conv.updated_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):new Date(conv.lastMessage?.created_at||conv.updated_at).toLocaleDateString()}</Text></View><Text style={s.muted}>{conv.lastMessage?(conv.lastMessage.sender_id===session.user.id?"Вы: ":"")+conv.lastMessage.body:conv.person.city||"Личный чат"}</Text></TouchableOpacity>)}</>}<Text style={s.heading}>Чаты встреч</Text><Text style={s.muted}>Общие переписки компаний и приглашения на встречи.</Text>{invitations.length>0&&<><Text style={s.cardTitle}>Приглашения</Text>{invitations.map(inv=><View key={inv.id} style={s.card}><Text style={s.cardTitle}>{inv.events?.title||"Приглашение на встречу"}</Text><Text style={s.muted}>{inv.events?.category||"Встреча"} · до {inv.events?.capacity||"—"} человек</Text>{inv.events?.status==="cancelled"?<Text style={s.note}>Встреча отменена организатором. Принимать приглашение уже нельзя.</Text>:<View style={s.rowBetween}><Button label="Принять" onPress={()=>respondInvitation(inv.id,true)}/><Button label="Отклонить" secondary onPress={()=>respondInvitation(inv.id,false)}/></View>}</View>)}</>}{activeChat?<View style={s.card}><View style={s.rowBetween}><Text style={s.cardTitle}>{activeChat.title}</Text><TouchableOpacity onPress={()=>setActiveChat(null)}><Text style={s.purple}>К списку</Text></TouchableOpacity></View><Text style={s.muted}>Общий чат участников встречи. Удерживай чужое сообщение, чтобы пожаловаться.</Text><TextInput value={groupMessageSearch} onChangeText={setGroupMessageSearch} style={s.input} placeholder="Поиск в загруженной истории..." placeholderTextColor="#777D8C" editable={true}/><View style={{maxHeight:330,marginTop:10}}><ScrollView nestedScrollEnabled>{chatHasMore&&<Button label={chatLoadingOlder?"Загружаем...":"Загрузить ранние сообщения"} secondary onPress={loadOlderGroupMessages} disabled={chatLoadingOlder}/>}{filteredGroupMessages.map(m=><TouchableOpacity key={m.id} activeOpacity={1} onLongPress={()=>reportChatMessage(m,activeChat.id)} style={[s.messageBubble,m.sender_id===session.user.id&&s.messageMine]}><Text style={s.messageText}>{m.body}</Text><Text style={s.messageTime}>{new Date(m.created_at).toLocaleString()}</Text></TouchableOpacity>)}{chatMessages.length===0?<Text style={s.empty}>Пока сообщений нет. Напиши первым!</Text>:filteredGroupMessages.length===0?<Text style={s.empty}>В загруженной истории таких сообщений нет.</Text>:null}</ScrollView></View><TextInput value={chatDraft} onChangeText={setChatDraft} style={s.input} editable={activeChat.status!=="cancelled"} placeholder={activeChat.status==="cancelled"?"Встреча отменена — чат только для чтения":"Напиши всем участникам..."} placeholderTextColor="#777D8C"/><Text style={s.note}>{chatDraft.length}/2000 · Черновик сохраняется на этом устройстве.</Text><Button label={chatBusy?"Отправляем...":"Отправить сообщение"} disabled={chatBusy||!chatDraft.trim()||activeChat.status==="cancelled"} onPress={sendGroupMessage}/></View>:<>{groupEvents.length>0?<><Text style={s.cardTitle}>Общие чаты</Text>{groupEvents.map(ev=><TouchableOpacity key={ev.id} style={s.card} onPress={()=>{setActiveDirectChat(null);setActiveChat(ev);}}><Text style={s.cardTitle}>{ev.title}</Text><Text style={s.muted}>{ev.category||"Встреча"} · {ev.venue||"Место уточняется"}</Text>{ev.status==="cancelled"&&<Text style={s.note}>Встреча отменена · история чата сохранена</Text>}<Text style={s.purple}>Открыть общий чат →</Text></TouchableOpacity>)}</>:<View style={s.card}><Text style={{fontSize:30,marginBottom:8}}>💬</Text><Text style={s.cardTitle}>Пока нет общих чатов</Text><Text style={s.muted}>Когда ты примешь приглашение на встречу или тебя примут в компанию, здесь появится общий чат.</Text><Button label="Найти встречу" onPress={()=>setTab("Главная")}/></View>}</>}</>}{tab==="Профиль"&&<><Text style={s.heading}>Мой профиль</Text><Text style={s.muted}>Так твой профиль увидят другие пользователи, когда ты включишь публичность.</Text><View style={s.card}><View style={s.rowBetween}><Text style={s.cardTitle}>Заполнение профиля</Text><Text style={s.purple}>{profileCompletion}%</Text></View><View style={{height:8,backgroundColor:"#303541",borderRadius:6,overflow:"hidden",marginTop:8}}><View style={{height:8,width:(profileCompletion+"%") as `${number}%`,backgroundColor:"#A78BFA",borderRadius:6}}/></View><Text style={s.muted}>{profileCompletionItems.filter(Boolean).length} из {profileCompletionItems.length}: имя, возраст, город, описание, аватар и дополнительные фото. Заполни профиль, чтобы людям было проще начать разговор.</Text></View><View style={s.profilePhotoArea}>{avatarUrl?<Image source={{uri:avatarUrl}} style={s.profilePhoto}/>:<View style={s.profilePhotoPlaceholder}><Text style={s.profilePhotoLetter}>{name.slice(0,1).toUpperCase()||"Я"}</Text></View>}<Button label={avatarBusy?"Загружаем фото...":avatarUrl?"Изменить аватарку":"Добавить аватарку"} onPress={pickAvatar} secondary={avatarBusy}/><Text style={s.note}>Аватарка · JPG, PNG или WebP · до 5 МБ</Text></View><Text style={s.cardTitle}>Фотографии профиля · {profilePhotos.length}/5</Text><Text style={s.muted}>Добавь до пяти фотографий. Они хранятся отдельно от аватарки.</Text><View style={{flexDirection:"row",flexWrap:"wrap",gap:9,marginTop:12}}>{profilePhotos.map(photo=><View key={photo.id} style={{width:"30%",aspectRatio:1,borderRadius:12,overflow:"hidden",position:"relative"}}><Image source={{uri:photo.url}} style={{width:"100%",height:"100%"}}/><TouchableOpacity onPress={()=>removeProfilePhoto(photo)} style={{position:"absolute",right:5,top:5,backgroundColor:"rgba(0,0,0,0.75)",borderRadius:14,paddingHorizontal:8,paddingVertical:4}}><Text style={{color:"#fff",fontWeight:"800"}}>×</Text></TouchableOpacity></View>)}{profilePhotos.length<5&&<TouchableOpacity onPress={pickProfilePhoto} disabled={photosBusy} style={{width:"30%",aspectRatio:1,borderRadius:12,borderWidth:1,borderColor:"#62548D",borderStyle:"dashed",alignItems:"center",justifyContent:"center",backgroundColor:"#171A22"}}><Text style={{fontSize:28,color:"#B9A8FF"}}>＋</Text><Text style={{color:"#B9A8FF",fontSize:10,fontWeight:"800"}}>{photosBusy?"Загрузка":"Добавить фото"}</Text></TouchableOpacity>}</View><Text style={s.label}>Имя</Text><TextInput value={name} onChangeText={setName} maxLength={40} style={s.input} placeholder="Твоё имя" placeholderTextColor="#777D8C"/><Text style={s.label}>Возраст (18+)</Text><TextInput value={age} onChangeText={setAge} keyboardType="number-pad" style={s.input} placeholder="Возраст" placeholderTextColor="#777D8C"/><Text style={s.label}>Город</Text><TextInput value={profileCity} onChangeText={setProfileCity} style={s.input} placeholder="Твой город" placeholderTextColor="#777D8C"/><Text style={s.label}>О себе</Text><TextInput value={bio} onChangeText={setBio} maxLength={500} multiline style={[s.input,{minHeight:90,textAlignVertical:"top"}]} placeholder="Кто ты, что любишь и с кем хочешь познакомиться?" placeholderTextColor="#777D8C"/><Text style={s.label}>Статус на ближайшие 24 часа</Text><TextInput value={moodStatus} onChangeText={setMoodStatus} maxLength={80} style={s.input} placeholder="Например: Ищу компанию для прогулки" placeholderTextColor="#777D8C"/><View style={s.card}><Text style={s.cardTitle}>Push-уведомления</Text><Text style={s.muted}>Подключай уведомления только тогда, когда сам(а) этого хочешь. На web push пока не настроен; для Android/iOS нужен EAS projectId.</Text>{Platform.OS==="web"?<Text style={s.note}>Push-уведомления доступны после отдельной настройки web push.</Text>:<Button label={pushBusy?"Подключаем...":pushEnabled?"Обновить регистрацию устройства":"Включить push-уведомления"} secondary onPress={enablePushNotifications} disabled={pushBusy}/>}</View><View style={s.card}><Text style={s.cardTitle}>Кто может начинать личный чат</Text><Text style={s.muted}>Выбери, от кого ты готов(а) получать новые личные сообщения.</Text>{[{v:"matches",t:"Только взаимные симпатии",d:"Самый закрытый вариант."},{v:"liked",t:"Те, кому я поставил(а) лайк",d:"Ты первым(ой) проявляешь интерес."},{v:"all",t:"Все пользователи",d:"Любой пользователь может начать диалог."}].map(option=><TouchableOpacity key={option.v} disabled={messagePreferenceBusy} onPress={()=>saveMessagePreference(option.v)} style={[s.invitePerson,messagePreference===option.v&&s.invitePersonOn]}><Text style={s.messageText}>{messagePreference===option.v?"● ":"○ "}{option.t}</Text><Text style={s.muted}>{option.d}</Text></TouchableOpacity>)}{messagePreferenceBusy&&<Text style={s.note}>Сохраняем настройку...</Text>}</View><Text style={s.label}>Публичность профиля</Text><TouchableOpacity onPress={toggleDiscoverability} style={[s.visibilityToggle,{alignSelf:"flex-start",marginTop:8},mapVisible&&s.visibilityToggleOn]}><Text style={s.visibilityToggleText}>{mapVisible?"Профиль виден другим · Выключить":"Профиль скрыт · Включить видимость"}</Text></TouchableOpacity><View style={s.card}><View style={s.rowBetween}><Text style={s.cardTitle}>Заблокированные · {blockedUsers.length}</Text><TouchableOpacity onPress={loadBlockedUsers}><Text style={s.purple}>Обновить ↻</Text></TouchableOpacity></View>{blocksBusy?<Text style={s.empty}>Загружаем список...</Text>:blockedUsers.length===0?<Text style={s.muted}>Здесь появятся люди, которых ты заблокировал(а).</Text>:blockedUsers.map(person=><View key={person.blocked_id} style={s.rowBetween}><View style={{flex:1}}><Text style={s.messageText}>{person.display_name}, {person.age}</Text><Text style={s.muted}>{person.city||""}</Text></View><Button label="Разблокировать" secondary onPress={()=>unblockUser(person)}/></View>)}</View><Button label={moodBusy?"Сохраняем...":"Сохранить профиль"} onPress={saveProfile}/><Text style={s.note}>{saved?"Изменения сохранены. Статус автоматически истечёт через 24 часа.":"Фотографии и данные профиля сохраняются в Supabase."}</Text><Button label="Выйти из профиля" secondary onPress={()=>supabase.auth.signOut()}/>
 <View style={s.card}><Text style={s.cardTitle}>Управление данными</Text><Text style={s.muted}>Удаление аккаунта необратимо. Серверная функция удалит учётную запись и файлы профиля.</Text><Button label={deleteBusy?"Удаляем аккаунт...":"Удалить мой аккаунт навсегда"} secondary onPress={deleteMyAccount}/></View>
 {isModerator&&<View style={s.card}><View style={s.rowBetween}><Text style={s.cardTitle}>Модерация · жалобы</Text><TouchableOpacity onPress={loadModerationQueue}><Text style={s.purple}>Обновить ↻</Text></TouchableOpacity></View><Text style={s.muted}>Доступно только аккаунтам с ролью moderator/admin.</Text>{moderationBusy?<Text style={s.empty}>Загружаем жалобы...</Text>:moderationQueue.length===0?<Text style={s.muted}>Новых жалоб нет.</Text>:moderationQueue.map(report=><View key={report.id} style={{borderTopWidth:1,borderTopColor:"#303541",paddingTop:10,marginTop:10}}><Text style={s.messageText}>{report.reason||"Без описания"}</Text><Text style={s.muted}>От: {report.reporter_name||"Пользователь"} · На: {report.reported_name||report.event_title||"Объект недоступен"}</Text><Text style={s.note}>{new Date(report.created_at).toLocaleString()}</Text><View style={s.rowBetween}><Button label="В работу" secondary onPress={()=>reviewReport(report,"reviewing")}/><Button label="Закрыть" onPress={()=>reviewReport(report,"resolved")}/><Button label="Отклонить" secondary onPress={()=>reviewReport(report,"dismissed")}/></View></View>)}</View>}</>}
 </ScrollView><View style={s.nav}>{["Главная","Карта","Симпатии","Чаты","Профиль"].map(x=><TouchableOpacity key={x} onPress={()=>nav(x)} style={s.navItem}><Text style={[s.navIcon,tab===x&&s.purple]}>{x==="Главная"?"⌂":x==="Карта"?"⌖":x==="Симпатии"?"♡":x==="Чаты"?"▤":"◉"}</Text><Text style={[s.navText,tab===x&&s.purple]}>{x}</Text></TouchableOpacity>)}</View>
 <Modal visible={!!viewingProfile} transparent animationType="slide" onRequestClose={()=>setViewingProfile(null)}><View style={s.backdrop}><View style={[s.modal,{maxHeight:"88%"}]}><View style={s.rowBetween}><Text style={s.heading}>Профиль</Text><TouchableOpacity onPress={()=>setViewingProfile(null)}><Text style={s.purple}>Закрыть ✕</Text></TouchableOpacity></View>{viewingProfile&&<ScrollView showsVerticalScrollIndicator={false}><View style={s.profilePhotoArea}>{viewingProfile.avatar_url?<Image source={{uri:viewingProfile.avatar_url}} style={s.profilePhoto}/>:<View style={s.profilePhotoPlaceholder}><Text style={s.profilePhotoLetter}>{(viewingProfile.display_name||"?").slice(0,1).toUpperCase()}</Text></View>}</View><Text style={s.heading}>{viewingProfile.display_name}, {viewingProfile.age}</Text><Text style={s.muted}>{viewingProfile.city||""}</Text>{viewingProfile.mood_status&&(!viewingProfile.mood_expires_at||new Date(viewingProfile.mood_expires_at).getTime()>Date.now())&&<Text style={s.meta}>● {viewingProfile.mood_status}</Text>}<Text style={s.cardTitle}>О себе</Text><Text style={s.muted}>{viewingProfile.bio||"Пока ничего не рассказал(а) о себе."}</Text><Text style={s.cardTitle}>Фотографии</Text>{viewingProfileBusy?<Text style={s.empty}>Загружаем фотографии...</Text>:viewingPhotos.length===0?<Text style={s.muted}>Пока нет дополнительных фотографий.</Text>:<View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>{viewingPhotos.map(photo=><Image key={photo.id} source={{uri:photo.url}} style={{width:"31%",aspectRatio:1,borderRadius:10}}/>)}</View>}<View style={{marginTop:18}}><Button label="Пожаловаться на профиль" secondary onPress={()=>reportViewedProfile(viewingProfile)}/><View style={{height:8}}/><TouchableOpacity onPress={()=>blockViewedProfile(viewingProfile)} style={[s.button,{backgroundColor:"#492B35"}]}><Text style={[s.buttonText,{color:"#FFB5C3"}]}>Заблокировать пользователя</Text></TouchableOpacity></View></ScrollView>}</View></View></Modal>
 <Modal visible={quickOpen} transparent animationType="slide" onRequestClose={()=>setQuickOpen(false)}><View style={s.backdrop}><View style={s.modal}><View style={s.rowBetween}><Text style={s.heading}>⚡ Спонтанно</Text><TouchableOpacity onPress={()=>setQuickOpen(false)}><Text style={s.purple}>Закрыть ✕</Text></TouchableOpacity></View><Text style={s.muted}>Что хочется сделать?</Text><View style={s.filters}>{QUICK_ACTIVITIES.map(x=><TouchableOpacity key={x} onPress={()=>selectQuickActivity(x)} style={[s.chip,quickActivity===x&&s.chipOn]}><Text style={{color:quickActivity===x?"#171322":"#B7BBC5"}}>{x}</Text></TouchableOpacity>)}</View><Text style={s.label}>Когда?</Text><View style={s.filters}>{QUICK_TIMES.map(x=><TouchableOpacity key={x} onPress={()=>setQuickTime(x)} style={[s.chip,quickTime===x&&s.chipOn]}><Text style={{color:quickTime===x?"#171322":"#B7BBC5"}}>{x}</Text></TouchableOpacity>)}</View><Button label="Опубликовать предложение" onPress={createQuick}/><Text style={s.note}>Предложение появится у пользователей твоего города.</Text></View></View></Modal><Modal visible={inviteOpen} transparent animationType="slide" onRequestClose={()=>setInviteOpen(false)}><View style={s.backdrop}><View style={s.modal}><View style={s.rowBetween}><Text style={s.heading}>Кого пригласить?</Text><TouchableOpacity onPress={()=>setInviteOpen(false)}><Text style={s.purple}>Закрыть ✕</Text></TouchableOpacity></View><Text style={s.muted}>{inviteEvent?.title||"Встреча"} · выбери людей, которым ты поставил(а) лайк. Места включают организатора.</Text>{inviteCandidates.length===0?<Text style={s.empty}>Пока нет подходящих людей. Сначала отметь несколько профилей как «Нравится».</Text>:<ScrollView style={{maxHeight:280}}>{inviteCandidates.map((p:any)=><TouchableOpacity key={p.id} style={[s.rowBetween,s.invitePerson,selectedInvitees.includes(p.id)&&s.invitePersonOn]} onPress={()=>setSelectedInvitees(items=>items.includes(p.id)?items.filter(x=>x!==p.id):items.length<Math.max(0,inviteEvent?.availableSeats||0)?[...items,p.id]:items)}><Text style={s.messageText}>{p.display_name}, {p.age}</Text><Text style={s.purple}>{selectedInvitees.includes(p.id)?"✓ Выбран":"Выбрать"}</Text></TouchableOpacity>)}</ScrollView>}<Button label={chatBusy?"Отправляем...": "Отправить приглашения ("+selectedInvitees.length+")"} onPress={sendInvitations}/><Text style={s.note}>Можно пригласить не больше свободных мест. Получатели смогут принять или отклонить приглашение.</Text></View></View></Modal><Modal visible={!!managedEvent} transparent animationType="slide" onRequestClose={()=>setManagedEvent(null)}><View style={s.backdrop}><View style={[s.modal,{maxHeight:"85%"}]}><View style={s.rowBetween}><Text style={s.heading}>Заявки на участие</Text><TouchableOpacity onPress={()=>setManagedEvent(null)}><Text style={s.purple}>Закрыть ✕</Text></TouchableOpacity></View><Text style={s.muted}>{managedEvent?.title||"Встреча"} · проверяй заявки и выбирай участников.</Text>{requestsBusy?<Text style={s.empty}>Загружаем заявки...</Text>:pendingEventRequests.length===0?<View style={s.card}><Text style={s.cardTitle}>Новых заявок нет</Text><Text style={s.muted}>Когда кто-то захочет присоединиться, заявка появится здесь.</Text><Button label="Обновить" secondary onPress={()=>managedEvent&&openEventRequests(managedEvent)}/></View>:<ScrollView style={{maxHeight:420}}>{pendingEventRequests.map(request=><View key={request.user_id} style={s.card}><View style={s.rowBetween}><View style={{flex:1}}><Text style={s.messageText}>{request.person.display_name}, {request.person.age}</Text><Text style={s.muted}>{request.person.city||"Город не указан"}</Text><Text style={s.note}>Заявка · {new Date(request.created_at).toLocaleString()}</Text></View>{request.person.avatar_url?<Image source={{uri:request.person.avatar_url}} style={{width:44,height:44,borderRadius:22}}/>:null}</View><View style={s.rowBetween}><Button label={requestActionBusy===request.user_id?"...":"Принять"} onPress={()=>reviewEventRequest(request,true)} disabled={!!requestActionBusy}/><Button label="Отклонить" secondary onPress={()=>reviewEventRequest(request,false)} disabled={!!requestActionBusy}/></View></View>)}</ScrollView>}<Text style={s.note}>Количество мест проверяется перед подтверждением заявки.</Text></View></View></Modal>
<Modal visible={createOpen} transparent animationType="slide" onRequestClose={closeCreateModal}><View style={s.backdrop}><View style={s.modal}><View style={s.rowBetween}><Text style={s.heading}>{editingEvent?"Редактировать встречу":"Новая встреча"}</Text><TouchableOpacity onPress={closeCreateModal}><Text style={s.purple}>Закрыть ✕</Text></TouchableOpacity></View><Text style={s.label}>Название *</Text><TextInput value={title} onChangeText={setTitle} style={s.input} placeholder="Например, кофе и разговоры" placeholderTextColor="#777D8C"/><Text style={s.label}>Категория</Text><View style={s.filters}>{["Общение","Кофе","Игры","Настолки","Прогулка","Кино","Спорт","Другое"].map(x=><TouchableOpacity key={x} onPress={()=>setCategory(x)} style={[s.chip,category===x&&s.chipOn]}><Text style={{color:category===x?"#171322":"#B7BBC5"}}>{x}</Text></TouchableOpacity>)}</View><Text style={s.label}>Сколько человек максимум?</Text><View style={s.filters}>{[2,4,6,8,10,15,20,30].map(n=><TouchableOpacity key={n} onPress={()=>setCapacity(n)} style={[s.chip,capacity===n&&s.chipOn]}><Text style={{color:capacity===n?"#171322":"#B7BBC5"}}>{n}</Text></TouchableOpacity>)}</View><Text style={s.note}>Вместимость включает организатора.</Text><Text style={s.label}>Дата и время встречи *</Text><View style={{flexDirection:"row",gap:10}}><View style={{flex:1}}><Text style={s.muted}>Дата · ГГГГ-ММ-ДД</Text><TextInput value={eventDate} onChangeText={setEventDate} style={s.input} placeholder="2026-12-31" placeholderTextColor="#777D8C" keyboardType="numbers-and-punctuation" maxLength={10}/></View><View style={{flex:1}}><Text style={s.muted}>Время · ЧЧ:ММ</Text><TextInput value={eventTime} onChangeText={setEventTime} style={s.input} placeholder="19:30" placeholderTextColor="#777D8C" keyboardType="numbers-and-punctuation" maxLength={5}/></View></View><Text style={s.note}>Время вводится в часовом поясе устройства. Можно выбрать любую будущую дату.</Text><Text style={s.label}>Место *</Text><TextInput value={place} onChangeText={setPlace} style={s.input} placeholder="Кафе, парк, центр города..." placeholderTextColor="#777D8C"/><Text style={s.label}>Описание</Text><TextInput value={description} onChangeText={setDescription} style={[s.input,{minHeight:70,textAlignVertical:"top"}]} multiline placeholder="Что планируете?" placeholderTextColor="#777D8C"/><Button label={chatBusy?(editingEvent?"Сохраняем...":"Публикуем..."):(editingEvent?"Сохранить изменения":"Опубликовать встречу")} onPress={create} disabled={chatBusy}/><Text style={s.note}>{editingEvent?"Изменения увидят участники этой встречи.":"Встреча будет опубликована в твоём городе на выбранную дату и время."}</Text></View></View></Modal>
 </View></SafeAreaView>;
}
const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:"#0B0D12"},
 personCard:{backgroundColor:"#1B1D28",borderRadius:16,padding:15,marginTop:12,borderWidth:1,borderColor:"#3A344F"},personAvatar:{width:112,height:112,borderRadius:56,backgroundColor:"#29243A",alignItems:"center",justifyContent:"center",alignSelf:"center",overflow:"hidden",borderWidth:2,borderColor:"#A78BFA"},personAvatarImage:{width:"100%",height:"100%"},personAvatarLetter:{color:"#B9A8FF",fontSize:42,fontWeight:"900"},swipeButton:{paddingHorizontal:16,paddingVertical:13,borderRadius:22,flex:1,alignItems:"center",marginHorizontal:4},skipButton:{backgroundColor:"#303541"},likeButton:{backgroundColor:"#A78BFA"},skipText:{color:"#E1E3E8",fontWeight:"900"},likeText:{color:"#191426",fontWeight:"900"},invitePerson:{padding:12,borderRadius:10,backgroundColor:"#20232D",marginVertical:4},invitePersonOn:{borderWidth:1,borderColor:"#A78BFA"},quickHero:{backgroundColor:"#1B1830",borderRadius:18,padding:16,marginBottom:20,borderWidth:1,borderColor:"#514174"},
 quickGrid:{flexDirection:"row",flexWrap:"wrap",gap:9,marginBottom:18},
 quickTile:{width:"31.5%",minHeight:86,backgroundColor:"#171A22",borderRadius:14,borderWidth:1,borderColor:"#303541",alignItems:"center",justifyContent:"center",gap:6,padding:9},
 quickTileText:{color:"#F5F5F7",fontSize:11,fontWeight:"700"},
 mapPreview:{backgroundColor:"#151820",borderRadius:17,borderWidth:1,borderColor:"#292E39",padding:14,marginBottom:18},
 realMap:{height:520,minHeight:520,borderRadius:13,overflow:"hidden",marginTop:10,backgroundColor:"#e8e6df"},
 mapCanvas:{height:190,backgroundColor:"#202A2B",borderRadius:13,marginTop:10,overflow:"hidden",position:"relative"},
 mapRoad:{position:"absolute",left:-20,width:"120%",height:13,backgroundColor:"#344244",borderWidth:1,borderColor:"#53615A"},
 mapPin:{position:"absolute",alignItems:"center",backgroundColor:"#171A22",borderRadius:13,padding:5,borderWidth:1,borderColor:"#A78BFA"},
 mapEmoji:{fontSize:18},mapName:{color:"#F5F5F7",fontSize:9,fontWeight:"700"},
 mapCluster:{position:"absolute",width:58,height:58,borderRadius:29,backgroundColor:"rgba(167,139,250,0.24)",borderWidth:1,borderColor:"#B9A8FF",alignItems:"center",justifyContent:"center"},clusterCount:{color:"#F5F5F7",fontSize:17,fontWeight:"900"},clusterLabel:{color:"#E4DDFB",fontSize:8,fontWeight:"700"},visibilityToggle:{backgroundColor:"#303541",paddingHorizontal:15,paddingVertical:10,borderRadius:18},visibilityToggleOn:{backgroundColor:"#6D55B5"},visibilityToggleText:{color:"#FFFFFF",fontSize:10,fontWeight:"900"},
 starter:{color:"#D8D0F5",fontSize:12,lineHeight:18,backgroundColor:"#201D2D",padding:10,borderRadius:10,marginTop:6},
page:{flex:1,width:"100%",maxWidth:760,alignSelf:"center",backgroundColor:"#0B0D12"},content:{padding:20,paddingBottom:30},top:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:25},logo:{color:"#F5F5F7",fontSize:25,fontWeight:"900",letterSpacing:1},muted:{color:"#9CA2AE",fontSize:12,lineHeight:19,marginTop:5},avatar:{width:42,height:42,borderRadius:14,backgroundColor:"#242131",alignItems:"center",justifyContent:"center",overflow:"hidden"},avatarImage:{width:"100%",height:"100%"},profilePhotoArea:{alignItems:"center",paddingVertical:18,marginBottom:8},profilePhoto:{width:112,height:112,borderRadius:56,backgroundColor:"#242131"},profilePhotoPlaceholder:{width:112,height:112,borderRadius:56,backgroundColor:"#242131",alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#62548D"},profilePhotoLetter:{color:"#B9A8FF",fontSize:38,fontWeight:"900"},purple:{color:"#B9A8FF",fontWeight:"800"},hero:{backgroundColor:"#171522",borderRadius:20,padding:20,marginBottom:25,borderWidth:1,borderColor:"#302943"},eyebrow:{color:"#A78BFA",fontSize:10,fontWeight:"800",letterSpacing:1,marginBottom:10},heroTitle:{color:"#F5F5F7",fontSize:25,fontWeight:"900",marginBottom:8},heading:{color:"#F5F5F7",fontSize:21,fontWeight:"800",marginBottom:8},rowBetween:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:10,marginTop:8,marginBottom:8},input:{backgroundColor:"#171A22",borderWidth:1,borderColor:"#303541",borderRadius:12,color:"#F5F5F7",padding:13,marginTop:8,fontSize:13},filters:{flexDirection:"row",gap:8,paddingVertical:13,flexWrap:"wrap"},chip:{paddingHorizontal:13,paddingVertical:9,borderRadius:20,backgroundColor:"#20232D"},chipOn:{backgroundColor:"#A78BFA"},card:{backgroundColor:"#151820",borderRadius:17,borderWidth:1,borderColor:"#292E39",padding:16,marginBottom:13},cardTitle:{color:"#F5F5F7",fontSize:17,fontWeight:"800",marginTop:10,marginBottom:5},meta:{color:"#C4B5FD",fontSize:12,marginVertical:10},button:{backgroundColor:"#A78BFA",paddingHorizontal:14,paddingVertical:11,borderRadius:11,alignItems:"center",marginTop:10},buttonText:{color:"#191426",fontSize:12,fontWeight:"900"},secondary:{backgroundColor:"#282B36",borderWidth:1,borderColor:"#62548D"},secondaryText:{color:"#D2C7FF"},empty:{color:"#A7A3B2",padding:25,textAlign:"center"},label:{color:"#C9C5D3",fontSize:12,fontWeight:"700",marginTop:13},note:{color:"#7E8491",fontSize:11,textAlign:"center",marginVertical:12},
 messageBubble:{alignSelf:"flex-start",maxWidth:"88%",backgroundColor:"#252936",padding:11,borderRadius:13,marginVertical:5},messageMine:{alignSelf:"flex-end",backgroundColor:"#40345F"},messageText:{color:"#F5F5F7",fontSize:13,lineHeight:19},messageTime:{color:"#B6A9D8",fontSize:9,marginTop:5},nav:{flexDirection:"row",justifyContent:"space-around",alignItems:"center",backgroundColor:"#11141B",borderTopWidth:1,borderTopColor:"#272C36",paddingVertical:10},navItem:{alignItems:"center",minWidth:60},navIcon:{color:"#737987",fontSize:21},navText:{color:"#858B99",fontSize:10,marginTop:3},backdrop:{flex:1,backgroundColor:"rgba(0,0,0,0.8)",justifyContent:"center",padding:14},modal:{backgroundColor:"#171A22",borderRadius:20,padding:18,borderWidth:1,borderColor:"#39314F",width:"100%",maxWidth:560,alignSelf:"center"},noteText:{color:"#7E8491"},authWrap:{flexGrow:1,justifyContent:"center",padding:24,width:"100%",maxWidth:560,alignSelf:"center"},authMessage:{color:"#F0A0A0",fontSize:12,marginTop:12,lineHeight:18}
});