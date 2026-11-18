import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { Alert, Modal, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

type EventItem = { id:number; title:string; category:string; place:string; time:string; people:number; capacity:number; host:string; initials:string; accent:string; description:string };
const START_EVENTS:EventItem[] = [
 {id:1,title:"Вечер настольных игр",category:"Игры",place:"Центр · уютное кафе",time:"Сегодня, 19:00",people:3,capacity:5,host:"Алексей",initials:"А",accent:"#8B7CFF",description:"Ищем компанию для лёгких настолок, общения и хорошего вечера. Новичкам тоже рады."},
 {id:2,title:"Кофе и разговоры",category:"Кофе",place:"Рядом с парком",time:"Завтра, 12:30",people:2,capacity:4,host:"Марина",initials:"М",accent:"#E7A66A",description:"Без спешки познакомимся, выпьем кофе и обсудим всё на свете."},
 {id:3,title:"Прогулка и новые знакомства",category:"Прогулка",place:"Городской парк",time:"Суббота, 15:00",people:4,capacity:6,host:"Игорь",initials:"И",accent:"#69C6A5",description:"Пройдёмся по красивому маршруту, познакомимся и найдём новых друзей."},
 {id:4,title:"Пообщаемся после работы",category:"Общение",place:"Бар в центре",time:"Пятница, 20:00",people:2,capacity:4,host:"Денис",initials:"Д",accent:"#E47C91",description:"Неформальный вечер в общественном месте. Можно прийти просто пообщаться."}
];
const FILTERS = ["Все","Кофе","Игры","Прогулка","Общение"];
const PEOPLE = [{name:"Аня",age:27,about:"Люблю кофе, прогулки и новые знакомства",tag:"Кофе"},{name:"Максим",age:31,about:"Настолки, кино и разговоры обо всём",tag:"Игры"},{name:"Саша",age:25,about:"Ищу компанию для прогулок по городу",tag:"Прогулка"}];

export default function HomeScreen() {
 const [session,setSession] = useState<any>(null);
 const [authLoading,setAuthLoading] = useState(true);
 const [authMode,setAuthMode] = useState<"login"|"signup">("signup");
 const [email,setEmail] = useState("");
 const [password,setPassword] = useState("");
 const [authName,setAuthName] = useState("");
 const [authAge,setAuthAge] = useState("18");
 const [authCity,setAuthCity] = useState("");
 const [authBusy,setAuthBusy] = useState(false);
 const [authMessage,setAuthMessage] = useState("");
 const [tab,setTab] = useState("Встречи");
 const [events,setEvents] = useState(START_EVENTS);
 const [joined,setJoined] = useState<number[]>([]);
 const [search,setSearch] = useState("");
 const [filter,setFilter] = useState("Все");
 const [createOpen,setCreateOpen] = useState(false);
 const [title,setTitle] = useState("");
 const [place,setPlace] = useState("");
 const [description,setDescription] = useState("");
 const [category,setCategory] = useState("Общение");
 const [name,setName] = useState("Гость");
 const [age,setAge] = useState("18");
 const [bio,setBio] = useState("Открыт новым знакомствам");
 const [saved,setSaved] = useState(false);
 const [liked,setLiked] = useState<string[]>([]);
 useEffect(()=>{
  supabase.auth.getSession().then(({data})=>{setSession(data.session);setAuthLoading(false);}).catch(()=>setAuthLoading(false));
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,nextSession)=>{setSession(nextSession);});
  return ()=>subscription.unsubscribe();
 },[]);
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
    const {data,error}=await supabase.auth.signUp({email:email.trim(),password,options:{data:{display_name:authName.trim(),age:numericAge,city:authCity.trim()}}});
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
 const visible = useMemo(()=>events.filter(e=>(filter==="Все"||e.category===filter)&&[e.title,e.place,e.description].some(v=>v.toLowerCase().includes(search.trim().toLowerCase()))),[events,filter,search]);
 const create = () => {
  if(!title.trim()||!place.trim()){Alert.alert("Заполни обязательные поля","Нужно указать название и место встречи.");return;}
  const item:EventItem={id:Date.now(),title:title.trim(),category,place:place.trim(),time:"Время уточняется",people:1,capacity:6,host:name||"Ты",initials:(name||"Я").slice(0,1).toUpperCase(),accent:"#A78BFA",description:description.trim()||"Новая встреча в ПОСИДИМ. Присоединяйся!"};
  setEvents(current=>[item,...current]);setCreateOpen(false);setTitle("");setPlace("");setDescription("");setFilter("Все");setSearch("");setTab("Встречи");Alert.alert("Готово!","Встреча добавлена в список на этом устройстве.");
 };
 const join = (id:number) => setJoined(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);
 const nav = (item:string) => item==="Создать"?setCreateOpen(true):setTab(item);
 if(authLoading) return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content"/><View style={s.authWrap}><Text style={s.logo}>ПОСИДИМ<Text style={{color:"#A78BFA"}}>.</Text></Text><Text style={s.muted}>Проверяем вход...</Text></View></SafeAreaView>;
 if(!session) return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content"/><ScrollView contentContainerStyle={s.authWrap} keyboardShouldPersistTaps="handled"><Text style={s.logo}>ПОСИДИМ<Text style={{color:"#A78BFA"}}>.</Text></Text><Text style={s.heroTitle}>{authMode==="signup"?"Знакомства начинаются здесь":"С возвращением!"}</Text><Text style={[s.muted,{marginBottom:18}]}>{authMode==="signup"?"Создай аккаунт, чтобы находить людей и встречи рядом.":"Войди, чтобы продолжить общение и находить встречи."}</Text>
 {authMode==="signup"&&<><Text style={s.label}>Имя</Text><TextInput value={authName} onChangeText={setAuthName} style={s.input} placeholder="Как тебя зовут?" placeholderTextColor="#777D8C"/><Text style={s.label}>Возраст (18+)</Text><TextInput value={authAge} onChangeText={setAuthAge} keyboardType="number-pad" style={s.input} placeholder="Возраст" placeholderTextColor="#777D8C"/><Text style={s.label}>Город</Text><TextInput value={authCity} onChangeText={setAuthCity} style={s.input} placeholder="Твой город" placeholderTextColor="#777D8C"/></>}
 <Text style={s.label}>Электронная почта</Text><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={s.input} placeholder="name@example.com" placeholderTextColor="#777D8C"/><Text style={s.label}>Пароль</Text><TextInput value={password} onChangeText={setPassword} secureTextEntry style={s.input} placeholder="Минимум 6 символов" placeholderTextColor="#777D8C"/>
 {authMessage!==""&&<Text style={s.authMessage}>{authMessage}</Text>}
 <TouchableOpacity disabled={authBusy} onPress={handleAuth} style={[s.button,{marginTop:20,opacity:authBusy?0.6:1}]}><Text style={s.buttonText}>{authBusy?"Подожди...":authMode==="signup"?"Создать аккаунт":"Войти"}</Text></TouchableOpacity>
 <TouchableOpacity onPress={()=>{setAuthMode(authMode==="signup"?"login":"signup");setAuthMessage("");}} style={{padding:16,alignItems:"center"}}><Text style={s.purple}>{authMode==="signup"?"Уже есть аккаунт? Войти":"Нет аккаунта? Зарегистрироваться"}</Text></TouchableOpacity>
 <Text style={s.note}>Продолжая, ты подтверждаешь, что тебе исполнилось 18 лет. Сейчас доступен вход по почте; VK и Telegram подключим отдельно.</Text>
 </ScrollView></SafeAreaView>;
 const Header=()=> <View style={s.top}><View><Text style={s.logo}>ПОСИДИМ<Text style={{color:"#A78BFA"}}>.</Text></Text><Text style={s.muted}>Люди рядом. Встречи по душе.</Text></View><View style={s.avatar}><Text style={s.purple}>{name.slice(0,1).toUpperCase()||"Я"}</Text></View></View>;
 const Button=({label,onPress,secondary=false}:{label:string;onPress:()=>void;secondary?:boolean})=><TouchableOpacity onPress={onPress} style={[s.button,secondary&&s.secondary]}><Text style={[s.buttonText,secondary&&s.secondaryText]}>{label}</Text></TouchableOpacity>;
 return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content"/><View style={s.page}><ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}><Header/>
 {tab==="Встречи"&&<><View style={s.hero}><Text style={s.eyebrow}>ТВОЙ ГОРОД, ТВОЯ КОМПАНИЯ</Text><Text style={s.heroTitle}>Не сиди один. Посидим?</Text><Text style={s.muted}>Находи людей, собирай компанию и проводи время так, как нравится тебе.</Text></View><View style={s.rowBetween}><Text style={s.heading}>Куда сегодня?</Text><Text style={s.purple}>{visible.length} рядом</Text></View><TextInput value={search} onChangeText={setSearch} placeholder="Поиск по встречам и местам" placeholderTextColor="#777D8C" style={s.input}/><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>{FILTERS.map(x=><TouchableOpacity key={x} onPress={()=>setFilter(x)} style={[s.chip,filter===x&&s.chipOn]}><Text style={{color:filter===x?"#171322":"#B7BBC5"}}>{x}</Text></TouchableOpacity>)}</ScrollView>{visible.length===0?<Text style={s.empty}>Ничего не найдено. Попробуй другой запрос.</Text>:visible.map(e=>{const yes=joined.includes(e.id);return <View key={e.id} style={s.card}><View style={s.rowBetween}><Text style={s.purple}>{e.host} · {e.category}</Text><Text style={s.muted}>{e.time}</Text></View><Text style={s.cardTitle}>{e.title}</Text><Text style={s.muted}>{e.description}</Text><Text style={s.meta}>⌖  {e.place}</Text><View style={s.rowBetween}><Text style={s.muted}>{e.people+(yes?1:0)} из {e.capacity} участников</Text><Button label={yes?"Отменить запись":"Хочу пойти"} secondary={yes} onPress={()=>join(e.id)}/></View></View>})}</>}
 {tab==="Люди"&&<><Text style={s.heading}>Люди рядом</Text><Text style={s.muted}>Знакомься и находи компанию по интересам</Text>{PEOPLE.map(p=>{const yes=liked.includes(p.name);return <View style={s.card} key={p.name}><Text style={s.cardTitle}>{p.name}, {p.age}</Text><Text style={s.muted}>{p.about}</Text><Text style={s.meta}>Интерес: {p.tag}</Text><Button label={yes?"Заявка отправлена ✓":"Познакомиться"} onPress={()=>setLiked(v=>yes?v.filter(x=>x!==p.name):[...v,p.name])}/></View>})}</>}
 {tab==="Профиль"&&<><Text style={s.heading}>Мой профиль</Text><Text style={s.muted}>Расскажи немного о себе — так людям будет проще познакомиться.</Text><Text style={s.label}>Имя</Text><TextInput value={name} onChangeText={setName} style={s.input} placeholder="Твоё имя" placeholderTextColor="#777D8C"/><Text style={s.label}>Возраст (18+)</Text><TextInput value={age} onChangeText={setAge} keyboardType="number-pad" style={s.input} placeholder="Возраст" placeholderTextColor="#777D8C"/><Text style={s.label}>О себе</Text><TextInput value={bio} onChangeText={setBio} multiline style={[s.input,{minHeight:90,textAlignVertical:"top"}]} placeholder="Пара слов о себе" placeholderTextColor="#777D8C"/><Button label="Сохранить профиль" onPress={()=>{if(Number(age)<18||!Number.isFinite(Number(age))){Alert.alert("Доступ 18+","Укажи возраст 18 лет или старше.");return;}setSaved(true);Alert.alert("Сохранено","Профиль обновлён на этом устройстве.");}}/><Text style={s.note}>{saved?"Изменения сохранены.":"Профиль пока хранится только в этой демо-версии."}</Text><Button label="Выйти из профиля" secondary onPress={()=>supabase.auth.signOut()}/></>}
 </ScrollView><View style={s.nav}>{["Встречи","Люди","Создать","Профиль"].map(x=><TouchableOpacity key={x} onPress={()=>nav(x)} style={s.navItem}><Text style={[s.navIcon,tab===x&&s.purple]}>{x==="Встречи"?"⌂":x==="Люди"?"♧":x==="Создать"?"+":"◉"}</Text><Text style={[s.navText,tab===x&&s.purple]}>{x}</Text></TouchableOpacity>)}</View>
 <Modal visible={createOpen} transparent animationType="slide" onRequestClose={()=>setCreateOpen(false)}><View style={s.backdrop}><View style={s.modal}><View style={s.rowBetween}><Text style={s.heading}>Новая встреча</Text><TouchableOpacity onPress={()=>setCreateOpen(false)}><Text style={s.purple}>Закрыть ✕</Text></TouchableOpacity></View><Text style={s.label}>Название *</Text><TextInput value={title} onChangeText={setTitle} style={s.input} placeholder="Например, кофе и разговоры" placeholderTextColor="#777D8C"/><Text style={s.label}>Категория</Text><View style={s.filters}>{["Общение","Кофе","Игры","Прогулка"].map(x=><TouchableOpacity key={x} onPress={()=>setCategory(x)} style={[s.chip,category===x&&s.chipOn]}><Text style={{color:category===x?"#171322":"#B7BBC5"}}>{x}</Text></TouchableOpacity>)}</View><Text style={s.label}>Место *</Text><TextInput value={place} onChangeText={setPlace} style={s.input} placeholder="Кафе, парк, центр города..." placeholderTextColor="#777D8C"/><Text style={s.label}>Описание</Text><TextInput value={description} onChangeText={setDescription} style={[s.input,{minHeight:70,textAlignVertical:"top"}]} multiline placeholder="Что планируете?" placeholderTextColor="#777D8C"/><Button label="Опубликовать встречу" onPress={create}/><Text style={s.note}>Демо: встреча видна только на этом устройстве.</Text></View></View></Modal>
 </View></SafeAreaView>;
}
const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:"#0B0D12"},page:{flex:1,width:"100%",maxWidth:760,alignSelf:"center",backgroundColor:"#0B0D12"},content:{padding:20,paddingBottom:30},top:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:25},logo:{color:"#F5F5F7",fontSize:25,fontWeight:"900",letterSpacing:1},muted:{color:"#9CA2AE",fontSize:12,lineHeight:19,marginTop:5},avatar:{width:42,height:42,borderRadius:14,backgroundColor:"#242131",alignItems:"center",justifyContent:"center"},purple:{color:"#B9A8FF",fontWeight:"800"},hero:{backgroundColor:"#171522",borderRadius:20,padding:20,marginBottom:25,borderWidth:1,borderColor:"#302943"},eyebrow:{color:"#A78BFA",fontSize:10,fontWeight:"800",letterSpacing:1,marginBottom:10},heroTitle:{color:"#F5F5F7",fontSize:25,fontWeight:"900",marginBottom:8},heading:{color:"#F5F5F7",fontSize:21,fontWeight:"800",marginBottom:8},rowBetween:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:10,marginTop:8,marginBottom:8},input:{backgroundColor:"#171A22",borderWidth:1,borderColor:"#303541",borderRadius:12,color:"#F5F5F7",padding:13,marginTop:8,fontSize:13},filters:{flexDirection:"row",gap:8,paddingVertical:13,flexWrap:"wrap"},chip:{paddingHorizontal:13,paddingVertical:9,borderRadius:20,backgroundColor:"#20232D"},chipOn:{backgroundColor:"#A78BFA"},card:{backgroundColor:"#151820",borderRadius:17,borderWidth:1,borderColor:"#292E39",padding:16,marginBottom:13},cardTitle:{color:"#F5F5F7",fontSize:17,fontWeight:"800",marginTop:10,marginBottom:5},meta:{color:"#C4B5FD",fontSize:12,marginVertical:10},button:{backgroundColor:"#A78BFA",paddingHorizontal:14,paddingVertical:11,borderRadius:11,alignItems:"center",marginTop:10},buttonText:{color:"#191426",fontSize:12,fontWeight:"900"},secondary:{backgroundColor:"#282B36",borderWidth:1,borderColor:"#62548D"},secondaryText:{color:"#D2C7FF"},empty:{color:"#A7A3B2",padding:25,textAlign:"center"},label:{color:"#C9C5D3",fontSize:12,fontWeight:"700",marginTop:13},note:{color:"#7E8491",fontSize:11,textAlign:"center",marginVertical:12},nav:{flexDirection:"row",justifyContent:"space-around",alignItems:"center",backgroundColor:"#11141B",borderTopWidth:1,borderTopColor:"#272C36",paddingVertical:10},navItem:{alignItems:"center",minWidth:60},navIcon:{color:"#737987",fontSize:21},navText:{color:"#858B99",fontSize:10,marginTop:3},backdrop:{flex:1,backgroundColor:"rgba(0,0,0,0.8)",justifyContent:"center",padding:14},modal:{backgroundColor:"#171A22",borderRadius:20,padding:18,borderWidth:1,borderColor:"#39314F",width:"100%",maxWidth:560,alignSelf:"center"},noteText:{color:"#7E8491"},authWrap:{flexGrow:1,justifyContent:"center",padding:24,width:"100%",maxWidth:560,alignSelf:"center"},authMessage:{color:"#F0A0A0",fontSize:12,marginTop:12,lineHeight:18}
});