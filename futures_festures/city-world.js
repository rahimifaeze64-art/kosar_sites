/**
 * city-world.js — Three.js 3D City Navigation
 * کاراکتر سوم شخص داخل شهر 3D حرکت می‌کنه
 * هر ساختمان = یک صفحه از سیستم
 */

const CityWorld = (function () {

  // ─────────────────────────────────────────────
  // تنظیمات ساختمان‌ها
  // هر آیتم = یک ساختمان با رنگ، موقعیت، صفحه مقصد
  // ─────────────────────────────────────────────
  const BUILDINGS_CONFIG = [
    {
      id: 'dashboard',
      label: 'داشبورد',
      icon: '📊',
      page: 'dashboard',
      role: null,
      position: { x: 0, z: 0 },
      color: 0x3b82f6,
      roofColor: 0x1d4ed8,
      width: 6, height: 10, depth: 6,
    },
    {
      id: 'students',
      label: 'دانشجویان',
      icon: '🎓',
      page: 'students',
      role: ['manager', 'employee'],
      position: { x: 50, z: 0 },
      color: 0x10b981,
      roofColor: 0x047857,
      width: 5, height: 8, depth: 5,
    },
    {
      id: 'orders',
      label: 'سفارشات',
      icon: '📋',
      page: 'orders',
      role: ['manager', 'employee'],
      position: { x: -50, z: 0 },
      color: 0xf59e0b,
      roofColor: 0xd97706,
      width: 5, height: 7, depth: 5,
    },
    {
      id: 'embassy',
      label: 'سفارت',
      icon: '🏛️',
      page: 'embassy',
      role: ['manager', 'employee'],
      position: { x: 0, z: 55 },
      color: 0xef4444,
      roofColor: 0xb91c1c,
      width: 7, height: 12, depth: 7,
    },
    {
      id: 'accounting',
      label: 'حسابداری',
      icon: '💰',
      page: 'accounting',
      role: ['manager', 'employee'],
      position: { x: 0, z: -55 },
      color: 0x8b5cf6,
      roofColor: 0x6d28d9,
      width: 5, height: 8, depth: 5,
    },
    {
      id: 'tasks',
      label: 'مدیریت وظایف',
      icon: '✅',
      page: 'tasks',
      role: ['manager'],
      position: { x: 50, z: 55 },
      color: 0x06b6d4,
      roofColor: 0x0e7490,
      width: 5, height: 7, depth: 5,
    },
    {
      id: 'myTasks',
      label: 'وظایف من',
      icon: '📌',
      page: 'myTasks',
      role: ['employee'],
      position: { x: 50, z: -55 },
      color: 0xf97316,
      roofColor: 0xc2410c,
      width: 4, height: 6, depth: 4,
    },
    {
      id: 'chat',
      label: 'گفتگو',
      icon: '💬',
      page: 'personalChat',
      role: null,
      position: { x: -50, z: 55 },
      color: 0xec4899,
      roofColor: 0xbe185d,
      width: 4, height: 6, depth: 4,
    },
    {
      id: 'workChecklist',
      label: 'چک‌لیست',
      icon: '☑️',
      page: 'workChecklist',
      role: ['employee'],
      position: { x: -50, z: -55 },
      color: 0x14b8a6,
      roofColor: 0x0f766e,
      width: 4, height: 6, depth: 4,
    },
    {
      id: 'agentTasks',
      label: 'وظایف عامل',
      icon: '🔧',
      page: 'agentTasks',
      role: ['agent'],
      position: { x: 80, z: 0 },
      color: 0xa855f7,
      roofColor: 0x7e22ce,
      width: 5, height: 7, depth: 5,
    },
    {
      id: 'agentAccounting',
      label: 'حسابداری عامل',
      icon: '💳',
      page: 'agentAccounting',
      role: ['agent'],
      position: { x: -80, z: 0 },
      color: 0x84cc16,
      roofColor: 0x4d7c0f,
      width: 5, height: 7, depth: 5,
    },
    {
      id: 'companyDoor',
      label: 'در شرکت',
      icon: '🚪',
      page: 'companyDoor',
      role: ['manager', 'employee'],
      position: { x: 80, z: 55 },
      color: 0x64748b,
      roofColor: 0x334155,
      width: 4, height: 5, depth: 4,
    },
    {
      id: 'profile',
      label: 'تنظیمات',
      icon: '⚙️',
      page: 'profile',
      role: null,
      position: { x: -80, z: -55 },
      color: 0x6b7280,
      roofColor: 0x374151,
      width: 4, height: 5, depth: 4,
    },
    {
      id: 'managementChat',
      label: 'گفتگو مدیریت',
      icon: '👥',
      page: 'managementChat',
      role: ['manager', 'employee'],
      position: { x: 0, z: 90 },
      color: 0x0284c7,
      roofColor: 0x0369a1,
      width: 6, height: 9, depth: 6,
    },
    // ─── منطقه دانشگاهی (شمال‌شرق شهر) ───
    {
      id: 'university',
      label: 'دانشگاه',
      icon: '🏛️',
      page: 'students',
      role: ['manager', 'employee'],
      position: { x: 200, z: 205 },
      color: 0x7c3aed,
      roofColor: 0x5b21b6,
      width: 8, height: 14, depth: 8,
    },
    {
      id: 'faculty',
      label: 'دانشکده',
      icon: '🎓',
      page: 'students',
      role: ['manager', 'employee'],
      position: { x: 180, z: 178 },
      color: 0x8b5cf6,
      roofColor: 0x6d28d9,
      width: 6, height: 10, depth: 6,
    },
    {
      id: 'universityLibrary',
      label: 'کتابخانه',
      icon: '📚',
      page: 'orders',
      role: ['manager', 'employee'],
      position: { x: 220, z: 228 },
      color: 0xb45309,
      roofColor: 0x92400e,
      width: 6, height: 11, depth: 6,
    },
    {
      id: 'researchCenter',
      label: 'پژوهشگاه',
      icon: '🔬',
      page: 'orders',
      role: ['manager', 'employee'],
      position: { x: 236, z: 188 },
      color: 0x0d9488,
      roofColor: 0x0f766e,
      width: 5, height: 8, depth: 5,
    },
  ];

  // ─────────────────────────────────────────────
  // متغیرهای داخلی
  // ─────────────────────────────────────────────
  let scene, camera, renderer, clock;
  let character, characterMixer;
  let buildings = [];
  let labels = [];
  let nearBuilding = null;
  let enterPromptVisible = false;
  let onPageChange = null;
  let currentUserRole = 'manager';

  // ─── ماشین ───
  let carMesh = null;           // گروه ماشین
  let inCar = false;            // آیا کاربر داخل ماشینه؟
  let nearCar = false;          // آیا نزدیک ماشینه؟
  const CAR_SPEED = 22;         // سرعت ماشین (سریع‌تر از پیاده)
  const CAR_TURN_SPEED = 1.8;   // سرعت چرخش ماشین
  const ENTER_CAR_DIST = 4.0;   // فاصله سوار شدن
  let carVelocity = 0;          // سرعت لحظه‌ای ماشین

  // کنترل ورودی
  const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false, f: false, Shift: false, ' ': false };
  const MOVE_SPEED = 8;
  const ENTER_DISTANCE = 4.5;

  // مقیاس minimap — برای شهر بزرگتر کوچکتر
  const MINIMAP_SCALE = 0.016;

  // ─── NPC ───
  let npcs = [];
  const NPC_CONFIGS = [
    {
      name: 'سارا', role: 'employee', color: 0xff69b4, headColor: 0xffd700, speed: 3.5,
      gender: 'female',
      gait: 'sway',        // ریتم گام
      energy: 0.62,        // شور و نشاط
      perk: 'phone',       // ژست روزمره
      stance: 0.5,
    },
    {
      name: 'زینب', role: 'employee', color: 0x9370db, headColor: 0xffd700, speed: 3.0,
      gender: 'female',
      gait: 'calm',
      energy: 0.55,
      perk: 'lookAround',
      stance: 0.45,
    },
    {
      name: 'فرزاد', role: 'employee', color: 0x20b2aa, headColor: 0xffa07a, speed: 4.0,
      gender: 'male',
      gait: 'brisk',
      energy: 0.9,
      perk: 'scratch',
      stance: 0.6,
    },
    {
      name: 'فاضلی', role: 'employee', color: 0xff8c00, headColor: 0xffa07a, speed: 3.2,
      gender: 'male',
      gait: 'casual',
      energy: 0.5,
      perk: 'armsCrossed',
      stance: 0.7,
    },
    {
      name: 'دکتر', role: 'employee', color: 0x32cd32, headColor: 0xffd700, speed: 3.8,
      gender: 'male',
      gait: 'steady',      // ایستاده و قائم — حالت پزشک
      energy: 0.42,
      perk: 'stretch',
      stance: 0.35,
    },
    {
      name: 'معصومی', role: 'agent', color: 0x4169e1, headColor: 0xffa07a, speed: 5.0,
      gender: 'male',
      gait: 'brisk',
      energy: 0.95,
      perk: 'watch',
      stance: 0.55,
    },
    {
      name: '-صادقی', role: 'agent', color: 0x8b0000, headColor: 0xffd700, speed: 4.5,
      gender: 'male',
      gait: 'sneak',      // قدم‌های سنگین و آرام
      energy: 0.48,
      perk: 'glanceSides',
      stance: 0.75,
    },
  ];

  // ─── دیالوگ‌های فارسی NPCها ───
  const NPC_DIALOGUES = {
    'سارا': [
      'سلام! امروز سفارش‌های جدید زیادی اومده، حسابی شلوغه!',
      'نمی‌دونی دفتر حسابداری کجاست؟ یه بار رفتم گم شدم!',
      'هوا امروز عالیه، وسوسه می‌شم زودتر برم خونه!',
      'اگه گزارش‌ها رو ندیدی، حتماً یه نگاه بنداز.',
      'می‌گم، تو ماشین جدید رو دیدی؟ بهم می‌رسه تندتر از قبلیه!',
    ],
    'زینب': [
      'سلام عزیزم! چطوری؟ خسته که نیستی؟',
      'دیروز تا دیر مشغول پرونده‌ها بودم... پشمم ریخت!',
      'دانشجوهای ترم جدید رسیدن؛ فضای دانشگاهی شده!',
      'چایی می‌خوری؟ من همین الان دارم دم می‌کنم.',
      'مواظب باش، فاضلی الان حال‌وحالای خرید ماشین داره!',
    ],
    'فرزاد': [
      'سلام! سرت شلوغ نیست؟ یه سوال فنی داشتم.',
      'سرور دیشب کند بود، فکر کنم هلی‌کوپترِ گزارش‌ها رو سنگین کرده!',
      'برو پایین شهرداری، هواش خنکه، یه نفس تازه بکش.',
      'من اگه جای تو بودم اول سراغ داشبورد می‌رفتم.',
      'شنیدی می‌خوان برای بخش وظایف اتاق جدید بگیرن؟',
    ],
    'فاضلی': [
      'سلام سلام! خوبی داداش؟',
      'دارم دنبال یه ماشین خوب می‌گردم... پیشنهادی داری؟',
      'امروزم حسابی ورزش کردم، صبح پارک دویدم!',
      'حسابداری گفت آخر ماه تسویه‌کنیم! چه خبر خوبی.',
      'یه سر به چت مدیریت بزن، پیام داری.',
    ],
    'دکتر': [
      'سلام. امیدوارم حالت عالی باشه.',
      'هر روز حداقل سی دقیقه پیاده‌روی کن — مثل من!',
      'استرس کاری رو با کار گروهی کم کنید، نه با قهوه!',
      'گزارش سلامت ماهانه رو دیدی؟ آمارها بهتر شده.',
      'اگر سرگیجه داری، اول آب بخور بعد سر کار برگرد!',
    ],
    'معصومی': [
      'سلام. مأموریتی داشتی یا گشتن می‌زنی؟',
      'حسابداری عامل هنوز گزارش این هفته رو نفرستاده...',
      'جنگنده رو دیدی؟ یکی از بهترین نمونه‌هاست، ولی بی‌اجازه دست نزن!',
      'امنیت ساختمان سفارت رو چک کردی؟',
      'کارمون زیاده ولی تمیز. مواظب خودت باش.',
    ],
    '-صادقی': [
      'هوم... توکی؟ خوش اومدی.',
      'اسرار شرکت تو سفارته! یادت نره.',
      'دیشب مأموریت شبانه داشتیم؛ خوابم نمیاد.',
      'اگه دنبال آدمی، من همونجام... ولی قیمت داره!',
      'تانک سواری بلدی؟ من بلدم. یه زمانی...',
    ],
  };
  const NPC_FALLBACK_LINES = [
    'سلام! روزت بخیر!',
    'امروز شهر خلوت‌تره، نه؟',
    'هوای خوشی داره!',
    'کارها زیاده ولی حالش هست!',
    'موفق باشی!',
  ];

  // ─── هلی‌کوپتر ───
  let helicopter = null;
  let helicopterAngle = 0;
  let helicopterHeight = 35;
  let helicopterRadius = 70;
  const HELI_SPEED = 0.008;

  // ─── تانک ───
  let tank = null;
  let tankVelocity = 0;
  let inTank = false;
  let nearTank = false;
  const TANK_SPEED = 6;
  const TANK_TURN_SPEED = 1.2;
  const ENTER_TANK_DIST = 5.0;

  // ─── سیستم اسلحه ───
  let weapon = null;
  let isAiming = false;
  let bullets = [];
  let bulletPool = [];
  let muzzleFlash = null;
  let lastShootTime = 0;
  const SHOOT_COOLDOWN = 120; // ms
  const BULLET_SPEED = 80;
  const BULLET_LIFE = 2.5; // ثانیه
  let mouse = new THREE.Vector2();
  let raycaster = new THREE.Raycaster();
  let shotsFired = 0;
  let kills = 0;

  // ─── فیزیک کاراکتر ───
  const GRAVITY = -30;
  const JUMP_SPEED = 9.5;
  const RUN_MULT = 1.75;
  let vertVel = 0;

  // ─── زاویه دید دوربین (با موس) ───
  let viewYaw = Math.PI;    // افق — دوربین پشت کاراکتر
  let viewPitch = 0.42;     // بالا/پایین

  // ─── محیط ───
  let fountainRef = null;
  const birdFlocks = [];
  const policeStations = [];
  let _policeFlagRef = null;
  let _skyscraperBeacons = null;

  // ─── شهر بزرگ‌تر ───
  const WORLD_EDGE = 272;      // مرز زمین ۶۰۰×۶۰۰
  let fountainOn = true;

  // ─── ترافیک و عابران ───
  const trafficCars = [];
  const pedestrians = [];
  let crosswalkSpots = [];

  // ─── سگ همراه ───
  let dog = null;
  let dogSit = false;

  // ─── فیزیک اشیا ───
  let football = null;
  const barrels = [];
  const BALL_HOME = { x: -125, z: -104 };

  // ─── هلی‌کوپتر قابل پرواز ───
  const HELI_PAD_POS = { x: 30, z: -30 };
  const HELI_MIN_ALT = 18;
  const HELI_MAX_ALT = 70;
  const HELI_CRUISE = 35;
  const HELI_ENTER_DIST = 6;
  let heliState = 'patrol';   // patrol | toPad | landing | landed | takeoff | player
  let inHeli = false;
  let nearHeli = false;
  let rotorSpeed = 0;
  let heliWaitTimer = 0;

  // ─── جت جنگنده ───
  let fighterJet = null;
  let jetState = 'parked';   // parked | roll | climb | player | approach | final
  let inJet = false;
  let nearJet = false;
  let jetSpeed = 0;
  const JET_MIN_FLY = 17;    // زیر این سرعت واماندگی
  const JET_MAX_SPD = 74;
  const JET_MAP_EDGE = 235;  // زمین ۶۰۰×۶۰۰ است؛ جت نباید از این بگذره
  let _jetEdgeToast = 0;

  // ─── گفتگو با NPC ───
  let nearNPC = null;
  let dialogOpen = false;
  let dialogNPC = null;

  // ─── سیستم پیشرفته NPC (معماری Codrops) ───
  // اگر مدل ریک‌شده Mixamo (.glb) داشتید آدرس را اینجا بگذارید؛
  // در غیر این صورت اسکلت رویه‌ای با همین نام استخوان‌ها استفاده می‌شود.
  const NPC_MODEL_URL = '';
  const NECK_MAX_DEG = 50;   // محدوده چرخش گردن
  const SPINE_MAX_DEG = 30;  // محدوده چرخش کمر

  // کلیپ‌های ری‌اکشن رویه‌ای — t نرمال‌شده ۰..۱
  const NPC_REACTIONS = {
    nod: {
      dur: 0.9,
      fn: (t) => ({ neck: { x: Math.sin(t * Math.PI * 3) * 0.28 } }),
    },
    lookAround: {
      dur: 2.6,
      fn: (t) => ({ neck: { y: Math.sin(t * Math.PI * 2) * 0.75 }, spine: { y: Math.sin(t * Math.PI * 2) * 0.18 } }),
    },
    shrug: {
      dur: 1.3,
      fn: (t) => ({
        armR: { z: -0.55 }, armL: { z: 0.55 },
        elbR: { x: -0.5 }, elbL: { x: -0.5 },
        neck: { x: -0.08 },
      }),
    },
    wave: {
      dur: 2.0,
      fn: (t) => ({
        armR: { x: -0.2, z: -2.45 },
        elbR: { x: -1.05 },
        handWave: Math.sin(t * Math.PI * 7) * 0.45,
        neck: { x: -0.05 },
      }),
    },
    talk: {
      dur: 1.0,
      loop: true,
      fn: (t) => ({
        mouth: Math.max(0, Math.sin(t * Math.PI * 8)) * 0.5,
        armR: { x: -0.35, z: -0.25 },
        elbR: { x: -0.85 + Math.sin(t * Math.PI * 4) * 0.25 },
        neck: { x: Math.sin(t * Math.PI * 4) * 0.07 },
        spine: { x: 0.04 },
      }),
    },
    // ─── ژست‌های روزمره واقع‌گرایانه ───
    armsCrossed: {
      dur: 2.4,
      fn: (t) => ({
        armR: { x: -0.95, z: 0.05 }, armL: { x: -0.95, z: -0.05 },
        elbR: { x: -1.35 }, elbL: { x: -1.35 },
        spine: { x: 0.06, y: 0 },
        shoulder: 0.12,
      }),
    },
    lookDown: {
      dur: 1.6,
      fn: (t) => ({
        neck: { x: 0.52, y: 0 }, spine: { x: 0.16, y: 0 },
        head: { x: -0.06 },
      }),
    },
    checkPhone: {
      dur: 2.2,
      loop: true,
      fn: (t) => ({
        armR: { x: -0.72, z: -0.5 },
        elbR: { x: -1.1 + Math.sin(t * Math.PI * 3) * 0.06 },
        head: { x: -0.1 },
        neck: { x: 0.42, y: -0.08 },
        spine: { x: 0.18, y: 0 },
        browL: 0.12,
      }),
    },
    scratch: {
      dur: 1.25,
      fn: (t) => ({
        armR: { x: 0.35, z: -1.7 },
        elbR: { x: -1.75 },
        head: { x: -0.05 },
        neck: { x: -0.28, y: 0 },
      }),
    },
    yawn: {
      dur: 2.2,
      fn: (t) => ({
        mouth: 0.9,
        head: { x: -0.28 },
        neck: { x: -0.12 },
        armR: { x: -1.0, z: -0.1 }, armL: { x: -1.0, z: 0.1 },
        elbR: { x: -0.35 }, elbL: { x: -0.35 },
        spine: { x: -0.1 },
      }),
    },
    stretch: {
      dur: 2.8,
      fn: (t) => ({
        armR: { x: -1.4, z: -0.15 }, armL: { x: -1.4, z: 0.15 },
        elbR: { x: -0.1 }, elbL: { x: -0.1 },
        spine: { x: -0.2, y: 0 },
        head: { x: -0.3 },
        mouth: 0.4,
      }),
    },
    hairFlip: {
      dur: 1.15,
      fn: (t) => ({
        head: { x: 0.42 },
        neck: { x: 0.1, y: -0.55 },
        armR: { x: -0.25, z: -0.85 },
        elbR: { x: -1.55 },
        spine: { x: 0.05, y: 0.12 },
      }),
    },
    glanceWatch: {
      dur: 1.4,
      fn: (t) => ({
        armR: { x: -0.55, z: 0.55 },
        elbR: { x: -1.45 },
        head: { x: -0.08 },
        neck: { x: 0.3, y: 0.25 },
      }),
    },
    glanceSides: {
      dur: 2.0,
      fn: (t) => ({
        neck: { y: Math.sin(t * Math.PI * 2.2) * 0.85, x: 0.05 },
        spine: { y: Math.sin(t * Math.PI * 2.2) * 0.22 },
        brow: 0.08,
      }),
    },
    sneeze: {
      dur: 0.9,
      fn: (t) => ({
        neck: { x: Math.sin(t * Math.PI * 3) * 0.4 },
        head: { x: Math.sin(t * Math.PI * 3) * 0.2 },
        mouth: Math.max(0, Math.sin(t * Math.PI * 2)) * 0.9,
        armR: { x: -0.5, z: -0.15 }, armL: { x: -0.5, z: 0.15 },
        elbR: { x: -0.7 }, elbL: { x: -0.7 },
        spine: { x: 0.08 },
      }),
    },
    // رجیستری گام هر شخصیت — برای راه‌رفتن‌های متفاوت
    // (Q = شخصیت انرژی/نشاط، به‌صورت ضریب‌های انیمیشن)
  };

  // ─── مدیریت listenerها برای destroy تمیز ───
  const _listeners = [];
  let _onKeyDown = null, _onKeyUp = null, _onClick = null, _onCtx = null, _onMove = null, _onPlc = null, _onResize = null;
  let _onAimDown = null, _onAimUp = null;
  function _listen(target, ev, fn) {
    target.addEventListener(ev, fn);
    _listeners.push([target, ev, fn]);
  }
  let _running = true;

  // ─── موانع استاتیک (جت و...) خارج از BUILDINGS_CONFIG ───
  const staticColliders = [];
  function _addCollider(x, z, hw, hd, onlyWhenParked) {
    staticColliders.push({ x, z, hw, hd, onlyWhenParked: !!onlyWhenParked });
  }

  // ─────────────────────────────────────────────
  // ساخت صحنه اصلی
  // ─────────────────────────────────────────────
  function init(containerId, pageChangeCallback, userRole) {
    onPageChange = pageChangeCallback;
    currentUserRole = userRole || 'manager';

    const container = document.getElementById(containerId);
    if (!container) { console.error('CityWorld: container not found:', containerId); return; }

    // Three.js Core
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 100, 400);

    clock = new THREE.Clock();

    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 700);
    camera.position.set(0, 14, -22);

    // رندرر
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // نور
    _buildLights();

    // زمین
    _buildGround();

    // جاده‌ها
    _buildRoads();

    // ساختمان‌ها
    _buildBuildings();

    // کاراکتر
    _buildCharacter();

    // ماشین
    _buildCar();

    // ─── سیستم‌های جدید ───────────────────────
    _buildNPCs();        // NPC کاربران
    _buildHelicopter();  // هلی‌کوپتر
    _buildTank();        // تانک
    _buildWeaponSystem(); // سیستم اسلحه (MP4 + موس)
    _buildBulletPool();  // استخر گلوله

    // ستاره‌های آسمان شبانه (خاموش پیش‌فرض)
    _buildSkyDetails();
    _buildBirds();
    _buildAirbase();
    _buildCityPark();
    _buildPoliceStation();
    _buildSkyscrapers();
    _buildTraffic();
    _buildPedestrians();
    _buildDog();
    _buildPhysicsProps();

    // رویدادها
    _bindEvents(container);
    _buildDialogUI();

    // شروع loop
    _running = true;
    _animate();

    // resize
    _onResize = () => {
      if (!renderer) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    _listen(window, 'resize', _onResize);

    console.log('✅ CityWorld initialized v2');
  }

  // ─────────────────────────────────────────────
  // نور
  // ─────────────────────────────────────────────
  function _buildLights() {
    // نور نیم‌کره (آسمان/زمین) + خورشید سایه‌انداز
    scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x4a5240, 0.6));

    // خورشید (directional)
    const sun = new THREE.DirectionalLight(0xfff5e0, 1.2);
    sun.position.set(50, 100, -60);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 350;
    sun.shadow.camera.left = -150;
    sun.shadow.camera.right = 150;
    sun.shadow.camera.top = 150;
    sun.shadow.camera.bottom = -150;
    scene.add(sun);

    // نور پشت (rim)
    const rim = new THREE.DirectionalLight(0xb0c4de, 0.3);
    rim.position.set(-20, 20, 30);
    scene.add(rim);
  }

  // ─────────────────────────────────────────────
  // زمین
  // ─────────────────────────────────────────────
  function _buildGround() {
    // زمین اصلی ۶۰۰×۶۰۰ — شهر بزرگ
    const geo = new THREE.PlaneGeometry(600, 600, 80, 80);
    const mat = new THREE.MeshLambertMaterial({ color: 0x4ade80 });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // درخت‌های پراکنده — پخش در کل شهر بزرگ
    for (let i = 0; i < 260; i++) {
      const gx = (Math.random() - 0.5) * 540;
      const gz = (Math.random() - 0.5) * 540;
      const tooClose = BUILDINGS_CONFIG.some(b => {
        const dx = gx - b.position.x, dz = gz - b.position.z;
        return Math.sqrt(dx*dx + dz*dz) < 10;
      });
      // دور از پارک بزرگ و بیس هوایی هم باشه
      const inPark = Math.abs(gx + 125) < 42 && Math.abs(gz + 118) < 42;
      const inAirbase = gx > 100 && Math.abs(gz) < 85;
      if (tooClose || inPark || inAirbase) continue;
      const treeH = 2.5 + Math.random() * 3;
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.22, treeH, 6),
        new THREE.MeshLambertMaterial({ color: 0x8B4513 })
      );
      trunk.position.set(gx, treeH / 2, gz);
      trunk.castShadow = true;
      scene.add(trunk);
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(1.2 + Math.random() * 0.8, 3 + Math.random() * 1.5, 7),
        new THREE.MeshLambertMaterial({ color: Math.random() > 0.3 ? 0x228B22 : 0x2d6a2d })
      );
      crown.position.set(gx, treeH + 1.5, gz);
      crown.castShadow = true;
      scene.add(crown);
    }

    // پارک‌ها — تکه‌های چمن تیره‌تر
    const parkMat = new THREE.MeshLambertMaterial({ color: 0x22c55e });
    [[20, 20], [-20, -20], [20, -70], [-20, 70]].forEach(([px, pz]) => {
      const park = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), parkMat);
      park.rotation.x = -Math.PI / 2;
      park.position.set(px, 0.01, pz);
      scene.add(park);
    });

    // فواره پارک اصلی + نیمکت‌ها
    _buildFountain(20, 20);
    _buildBenches();
  }

  // ─────────────────────────────────────────────
  // جاده‌ها — شبکه گسترده‌تر
  // ─────────────────────────────────────────────
  function _buildRoads() {
    const roadMat  = new THREE.MeshLambertMaterial({ color: 0x374151 });
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0xffd700 });
    const roadY = 0.02;

    // جاده‌های اصلی — شبکه شهر بزرگ
    const roads = [
      { w: 220, h: 7,  x: 0,   z: 0,   rot: 0 },   // افقی مرکزی
      { w: 7,   h: 220,x: 0,   z: 0,   rot: 0 },   // عمودی مرکزی
      { w: 180, h: 6,  x: 0,   z: 55,  rot: 0 },   // افقی شمالی
      { w: 180, h: 6,  x: 0,   z: -55, rot: 0 },   // افقی جنوبی
      { w: 6,   h: 180,x: 50,  z: 0,   rot: 0 },   // عمودی شرقی
      { w: 6,   h: 180,x: -50, z: 0,   rot: 0 },   // عمودی غربی
      { w: 6,   h: 160,x: 80,  z: 0,   rot: 0 },   // عمودی دور
      { w: 6,   h: 160,x: -80, z: 0,   rot: 0 },
      { w: 200, h: 6,  x: 0,   z: 90,  rot: 0 },   // افقی دور شمال
      { w: 200, h: 6,  x: 0,   z: -90, rot: 0 },
      // ─── کمربندی و محله‌های جدید ───
      { w: 320, h: 6,  x: -20, z: 140, rot: 0 },   // بیرونی شمال
      { w: 320, h: 6,  x: -20, z: -140,rot: 0 },   // بیرونی جنوب
      { w: 6,   h: 320,x: 140, z: 0,   rot: 0 },   // بیرونی شرق
      { w: 6,   h: 320,x: -140,z: 0,   rot: 0 },   // بیرونی غرب
      { w: 120, h: 5,  x: 75,  z: 118, rot: 0 },   // خیابان برج‌ها
      { w: 5,   h: 110,x: 122, z: -112,rot: 0 },   // خیابان پلیس‌گاه
    ];

    roads.forEach(r => {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.h), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(r.x, roadY, r.z);
      road.receiveShadow = true;
      scene.add(road);
    });

    // خط‌کشی جاده اصلی
    for (let i = -148; i < 152; i += 7) {
      const s1 = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 3.5), stripeMat);
      s1.rotation.x = -Math.PI / 2;
      s1.position.set(i, roadY + 0.01, 0);
      scene.add(s1);
      const s2 = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 0.25), stripeMat);
      s2.rotation.x = -Math.PI / 2;
      s2.position.set(0, roadY + 0.01, i);
      scene.add(s2);
    }

    // ─── خط عابر (زیبرا) در تقاطع‌های شلوغ ───
    crosswalkSpots = [
      [0, 8, true], [0, -8, true],
      [-8, 55, false], [8, 55, false],
      [-8, -55, false], [8, -55, false],
    ];
    crosswalkSpots.forEach(([cx, cz, horiz]) => {
      for (let i = -3; i <= 3; i++) {
        const st = new THREE.Mesh(
          horiz ? new THREE.PlaneGeometry(0.9, 4.2) : new THREE.PlaneGeometry(4.2, 0.9),
          new THREE.MeshBasicMaterial({ color: 0xe5e7eb })
        );
        st.rotation.x = -Math.PI / 2;
        if (horiz) st.position.set(cx + i * 1.35, roadY + 0.02, cz);
        else       st.position.set(cx, roadY + 0.02, cz + i * 1.35);
        scene.add(st);
      }
    });

    // چراغ‌های خیابان — دو محور x و z برای شهر بزرگ
    const poleM = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const armM  = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const lightM = new THREE.MeshBasicMaterial({ color: 0xfdf6d8 });
    function _lamp(x, z, axis) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6, 8), poleM);
      pole.position.set(x, 3, z);
      pole.castShadow = true;
      scene.add(pole);
      const inward = axis === 'x' ? (z > 0 ? -1 : 1) : (x > 0 ? -1 : 1);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? 0.08 : 1.4, 0.08, axis === 'x' ? 1.4 : 0.08), armM);
      arm.position.set(x + (axis === 'z' ? inward * 0.7 : 0), 5.95, z + (axis === 'x' ? inward * 0.7 : 0));
      scene.add(arm);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, 0.7), lightM);
      if (axis === 'z') { head.rotation.y = Math.PI / 2; head.scale.set(2, 1, 0.5); }
      head.position.set(x + (axis === 'z' ? inward * 1.3 : 0), 5.88, z + (axis === 'x' ? inward * 1.3 : 0));
      scene.add(head);
    }
    for (let i = -130; i <= 130; i += 26) {
      [[i, 5], [i, -5]].forEach(([x, z]) => _lamp(x, z, 'x'));
      [[5, i], [-5, i]].forEach(([x, z]) => _lamp(x, z, 'z'));
    }
  }

  // ─────────────────────────────────────────────
  // ساختمان‌ها
  // ─────────────────────────────────────────────
  function _buildBuildings() {
    buildings = [];

    BUILDINGS_CONFIG.forEach(cfg => {
      // فیلتر نقش
      const accessible = _isAccessible(cfg);

      const group = new THREE.Group();

      // بدنه ساختمان
      const bodyGeo = new THREE.BoxGeometry(cfg.width, cfg.height, cfg.depth);
      const bodyColor = accessible ? cfg.color : 0x6b7280;
      const bodyMat = new THREE.MeshPhongMaterial({
        color: bodyColor,
        shininess: 40,
        opacity: accessible ? 1.0 : 0.55,
        transparent: !accessible,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = cfg.height / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      // سقف
      const roofGeo = new THREE.ConeGeometry(cfg.width * 0.75, cfg.height * 0.4, 4);
      const roofMat = new THREE.MeshPhongMaterial({ color: accessible ? cfg.roofColor : 0x4b5563, shininess: 30 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.y = cfg.height + cfg.height * 0.2;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      group.add(roof);

      // در ساختمان
      const doorGeo = new THREE.BoxGeometry(0.8, 1.5, 0.1);
      const doorMat = new THREE.MeshPhongMaterial({ color: 0x92400e });
      const door = new THREE.Mesh(doorGeo, doorMat);
      door.position.set(0, 0.75, cfg.depth / 2 + 0.05);
      group.add(door);

      // پنجره‌ها
      if (accessible) {
        const winMat = new THREE.MeshPhongMaterial({ color: 0x93c5fd, emissive: 0x1e40af, emissiveIntensity: 0.3, shininess: 100 });
        const winPositions = [
          { x: -cfg.width * 0.25, y: cfg.height * 0.45 },
          { x: cfg.width * 0.25, y: cfg.height * 0.45 },
          { x: -cfg.width * 0.25, y: cfg.height * 0.75 },
          { x: cfg.width * 0.25, y: cfg.height * 0.75 },
        ];
        winPositions.forEach(wp => {
          const win = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.05), winMat);
          win.position.set(wp.x, wp.y, cfg.depth / 2 + 0.06);
          group.add(win);
        });
      }

      // تابلوی ساختمان (Sprite برای متن)
      const sprite = _makeTextSprite(cfg.icon + ' ' + cfg.label, accessible ? '#ffffff' : '#9ca3af');
      sprite.position.set(0, cfg.height + cfg.height * 0.45 + 1, 0);
      sprite.scale.set(6, 2, 1);
      group.add(sprite);
      labels.push(sprite);

      // هاله نور زیر ساختمان
      if (accessible) {
        const glowGeo = new THREE.CircleGeometry(cfg.width * 0.7, 16);
        const glowMat = new THREE.MeshBasicMaterial({ color: bodyColor, transparent: true, opacity: 0.15 });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.rotation.x = -Math.PI / 2;
        glow.position.y = 0.05;
        group.add(glow);
      }

      group.position.set(cfg.position.x, 0, cfg.position.z);
      scene.add(group);

      buildings.push({
        config: cfg,
        group,
        accessible,
        body,
        originalColor: bodyColor,
        isHighlighted: false,
      });
    });
  }

  // ─────────────────────────────────────────────
  // کاراکتر ساده (Capsule-style)
  // ─────────────────────────────────────────────
  function _buildCharacter() {
    // انسان واقع‌گرایانه — پیراهن آبی
    character = _makeCharacterMesh(0x2563eb);
    character.scale.setScalar(1.06);

    // فلش بالای کاراکتر
    const arrowSprite = _makeTextSprite('⬆ شما', '#fbbf24');
    arrowSprite.position.set(0, 2.55, 0);
    arrowSprite.scale.set(2.5, 0.9, 1);
    character.add(arrowSprite);

    character.position.set(0, 0, -10);
    scene.add(character);
  }

  // ─────────────────────────────────────────────
  // ساخت ماشین — سدان مدرن با جزییات کامل
  // ─────────────────────────────────────────────
  function _buildCar() {
    carMesh = new THREE.Group();

    const paintM   = new THREE.MeshPhongMaterial({ color: 0xd62828, shininess: 120 });
    const paintDk  = new THREE.MeshPhongMaterial({ color: 0x9d1b1b, shininess: 90 });
    const glassM   = new THREE.MeshPhongMaterial({ color: 0xa8cdf0, transparent: true, opacity: 0.55, shininess: 150 });
    const trimM    = new THREE.MeshPhongMaterial({ color: 0x1f2937 });
    const chromeM  = new THREE.MeshPhongMaterial({ color: 0xd1d5db, shininess: 140 });
    const tireM    = new THREE.MeshPhongMaterial({ color: 0x141414, shininess: 15 });

    // ─── بدنه سه‌حجمه: شاسی + کاپوت + صندوق ───
    const lower = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.52, 4.6), paintM);
    lower.position.y = 0.64;
    lower.castShadow = true;
    carMesh.add(lower);

    // کاپوت با شیب ملایم
    const hood = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.16, 1.35), paintM);
    hood.position.set(0, 0.97, 1.5);
    hood.rotation.x = -0.07;
    hood.castShadow = true;
    carMesh.add(hood);

    // صندوق عقب
    const trunkLid = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.18, 1.1), paintM);
    trunkLid.position.set(0, 0.99, -1.72);
    trunkLid.castShadow = true;
    carMesh.add(trunkLid);

    // ─── کابین + سقف ───
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.56, 2.25), paintDk);
    cabin.position.set(0, 1.32, -0.12);
    cabin.castShadow = true;
    carMesh.add(cabin);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.08, 1.95), paintM);
    roof.position.set(0, 1.63, -0.12);
    roof.castShadow = true;
    carMesh.add(roof);

    // ─── شیشه‌ها ───
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.62, 0.07), glassM);
    windshield.position.set(0, 1.3, 1.03);
    windshield.rotation.x = 0.42;
    carMesh.add(windshield);

    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 0.07), glassM);
    rearGlass.position.set(0, 1.31, -1.28);
    rearGlass.rotation.x = -0.48;
    carMesh.add(rearGlass);

    // شیشه‌های کناری (جلو و عقب هر طرف)
    [-1, 1].forEach(s => {
      [[0.55, 0.78], [-0.82, 0.72]].forEach(([wz, ww]) => {
        const sw = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, ww), glassM);
        sw.position.set(s * 0.92, 1.34, wz);
        carMesh.add(sw);
      });
      // ستون B وسط
      const bPillar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.52, 0.09), trimM);
      bPillar.position.set(s * 0.92, 1.32, -0.12);
      carMesh.add(bPillar);
    });

    // خط شکست بدنه (character line)
    [-1, 1].forEach(s => {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 4.2), trimM);
      line.position.set(s * 1.076, 0.86, 0);
      carMesh.add(line);
    });

    // ─── سپرها + جلوپنجره ───
    const bumperF = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.26, 0.32), trimM);
    bumperF.position.set(0, 0.5, 2.36);
    bumperF.castShadow = true;
    carMesh.add(bumperF);

    const bumperR = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.26, 0.32), trimM);
    bumperR.position.set(0, 0.5, -2.36);
    bumperR.castShadow = true;
    carMesh.add(bumperR);

    // جلوپنجره با پره‌های کروم
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.28, 0.07), trimM);
    grille.position.set(0, 0.78, 2.33);
    carMesh.add(grille);
    for (let i = 0; i < 4; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.03, 0.02), chromeM);
      slat.position.set(0, 0.68 + i * 0.07, 2.37);
      carMesh.add(slat);
    }

    // ─── چراغ‌ها ───
    const headM = new THREE.MeshPhongMaterial({ color: 0xfef9c3, emissive: 0xfde047, emissiveIntensity: 0.75, shininess: 100 });
    [-0.74, 0.74].forEach(x => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.17, 0.09), headM);
      hl.position.set(x, 0.83, 2.33);
      carMesh.add(hl);
      // مه‌شکن گرد
      const fog = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 10),
        new THREE.MeshPhongMaterial({ color: 0xfff7ed, emissive: 0xfef3c7, emissiveIntensity: 0.4 }));
      fog.rotation.x = Math.PI / 2;
      fog.position.set(x, 0.44, 2.42);
      carMesh.add(fog);
    });

    // نوار چراغ عقب سرتاسری قرمز + دنده معکوس
    const tailStrip = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.13, 0.07),
      new THREE.MeshPhongMaterial({ color: 0x7f1d1d, emissive: 0xdc2626, emissiveIntensity: 0.65 }));
    tailStrip.position.set(0, 0.88, -2.34);
    carMesh.add(tailStrip);
    const reverse = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.05),
      new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.3 }));
    reverse.position.set(0, 0.88, -2.36);
    carMesh.add(reverse);

    // ─── آینه‌های جانبی ───
    [-1, 1].forEach(s => {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 6), trimM);
      stalk.rotation.z = Math.PI / 2;
      stalk.position.set(s * 1.0, 1.42, 0.72);
      carMesh.add(stalk);
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.11, 0.05), trimM);
      mirror.position.set(s * 1.1, 1.43, 0.72);
      carMesh.add(mirror);
      const glassBit = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.04), chromeM);
      glassBit.position.set(s * 1.19, 1.43, 0.72);
      carMesh.add(glassBit);
    });

    // اگزوز دوقلو + پلاک
    [-0.62, 0.62].forEach(x => {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.22, 10), chromeM);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(x, 0.34, -2.45);
      carMesh.add(pipe);
    });
    const plateF = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.03),
      new THREE.MeshBasicMaterial({ color: 0xf5f5f4 }));
    plateF.position.set(0, 0.5, 2.53);
    carMesh.add(plateF);
    const plateR = plateF.clone();
    plateR.position.z = -2.53;
    carMesh.add(plateR);

    // آنتن روی سقف عقب
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.45, 4), trimM);
    antenna.position.set(-0.6, 1.88, -0.95);
    antenna.rotation.z = 0.12;
    carMesh.add(antenna);

    // ─── چرخ‌ها: لاستیک + رینگ حلقه‌ای + دیسک + توپی ───
    const wheels = [];
    const wheelPos = [
      { x:  1.05, z:  1.52, front: true },
      { x: -1.05, z:  1.52, front: true },
      { x:  1.05, z: -1.52, front: false },
      { x: -1.05, z: -1.52, front: false },
    ];
    // قوس چرخ تیره روی بدنه (well)
    wheelPos.forEach(wp => {
      const well = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.66, 1.0), tireM);
      well.position.set(wp.x > 0 ? 1.06 : -1.06, 0.66, wp.z);
      carMesh.add(well);
    });
    wheelPos.forEach(wp => {
      const wg = new THREE.Group();
      wg.position.set(wp.x, 0.38, wp.z);
      wg.userData.front = wp.front;

      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.26, 20), tireM);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wg.add(tire);

      // حلقه رینگ کروم
      const rimRing = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.035, 8, 18), chromeM);
      rimRing.rotation.y = Math.PI / 2;
      wg.add(rimRing);

      // دیسک داخلی تیره
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.27, 14),
        new THREE.MeshPhongMaterial({ color: 0x374151 }));
      disc.rotation.z = Math.PI / 2;
      wg.add(disc);

      // پره‌ها — ۵ تا
      for (let i = 0; i < 5; i++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.05, 0.045), chromeM);
        spoke.rotation.x = (i / 5) * Math.PI * 2;
        wg.add(spoke);
      }

      // توپ مرکز
      const hubCap = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), chromeM);
      hubCap.position.x = wp.x > 0 ? 0.1 : -0.1;
      wg.add(hubCap);

      carMesh.add(wg);
      wheels.push(wg);
    });

    carMesh.userData.wheels = wheels;

    // تابلوی "F برای سوار شدن" روی ماشین
    const carSprite = _makeTextSprite('🚗  F  سوار شو', '#fbbf24');
    carSprite.position.set(0, 3.2, 0);
    carSprite.scale.set(5, 1.5, 1);
    carSprite.name = 'carLabel';
    carMesh.add(carSprite);
    labels.push(carSprite);

    // موقعیت اولیه ماشین — کنار داشبورد
    carMesh.position.set(12, 0, -12);
    carMesh.rotation.y = Math.PI / 2;
    scene.add(carMesh);
  }

  // ─────────────────────────────────────────────
  // آسمان / ابرها
  // ─────────────────────────────────────────────
  function _buildSkyDetails() {
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 28; i++) {
      const cloudGroup = new THREE.Group();
      const cx = (Math.random() - 0.5) * 340;
      const cy = 45 + Math.random() * 30;
      const cz = (Math.random() - 0.5) * 340;
      [0, -1.5, 1.5, -0.7, 0.7, -2.2, 2.2].forEach((dx) => {
        const puff = new THREE.Mesh(
          new THREE.SphereGeometry(2 + Math.random() * 1.2, 7, 7),
          cloudMat
        );
        puff.position.set(dx * 1.8, Math.random() * 0.8, (Math.random() - 0.5) * 2);
        cloudGroup.add(puff);
      });
      cloudGroup.position.set(cx, cy, cz);
      cloudGroup.userData.cloudDrift = (Math.random() - 0.5) * 0.004;
      scene.add(cloudGroup);
    }
  }

  // ─────────────────────────────────────────────
  // پرنده‌ها
  // ─────────────────────────────────────────────
  function _buildBirds() {
    const wingM = new THREE.MeshBasicMaterial({ color: 0x1f2937, side: THREE.DoubleSide });
    for (let f = 0; f < 3; f++) {
      const flock = new THREE.Group();
      const count = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const bird = new THREE.Group();
        const wl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.3), wingM);
        wl.position.x = -0.42;
        const wr = wl.clone();
        wr.position.x = 0.42;
        bird.add(wl); bird.add(wr);
        bird.userData = {
          wl, wr,
          phase: Math.random() * Math.PI * 2,
          r: 60 + Math.random() * 50,
          h: 38 + Math.random() * 22,
          ang: Math.random() * Math.PI * 2,
          spd: 0.12 + Math.random() * 0.1,
        };
        bird.position.set(
          Math.cos(bird.userData.ang) * bird.userData.r,
          bird.userData.h,
          Math.sin(bird.userData.ang) * bird.userData.r
        );
        flock.add(bird);
      }
      scene.add(flock);
      birdFlocks.push(flock);
    }
  }

  // ─────────────────────────────────────────────
  // فواره پارک
  // ─────────────────────────────────────────────
  function _buildFountain(fx, fz) {
    const g = new THREE.Group();

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.6, 0.7, 20),
      new THREE.MeshPhongMaterial({ color: 0x94a3b8 })
    );
    base.position.y = 0.35;
    base.castShadow = true;
    g.add(base);

    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(2.9, 2.9, 0.25, 20),
      new THREE.MeshPhongMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75, shininess: 120 })
    );
    water.position.y = 0.72;
    water.name = 'water';
    g.add(water);

    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.4, 1.6, 10),
      new THREE.MeshPhongMaterial({ color: 0xcbd5e1 })
    );
    column.position.y = 1.5;
    column.castShadow = true;
    g.add(column);

    const jet = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 2.2, 10),
      new THREE.MeshPhongMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.55 })
    );
    jet.position.y = 3.2;
    jet.rotation.x = Math.PI;
    jet.name = 'jet';
    g.add(jet);

    g.position.set(fx, 0, fz);
    scene.add(g);
    fountainRef = g;
  }

  // ─────────────────────────────────────────────
  // نیمکت‌های پارک
  // ─────────────────────────────────────────────
  function _buildBenches() {
    const woodM = new THREE.MeshPhongMaterial({ color: 0x92400e });
    const legM  = new THREE.MeshPhongMaterial({ color: 0x333333 });
    [[20, 27, 0], [13, 20, Math.PI / 2], [-20, -13, 0], [-27, -20, Math.PI / 2]].forEach(([bx, bz, ry]) => {
      const bench = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.6), woodM);
      seat.position.y = 0.55;
      seat.castShadow = true;
      bench.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.1), woodM);
      back.position.set(0, 0.85, -0.26);
      back.castShadow = true;
      bench.add(back);
      [-1, 1].forEach(sx => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.55), legM);
        leg.position.set(sx * 1.0, 0.27, 0);
        bench.add(leg);
      });
      bench.position.set(bx, 0, bz);
      bench.rotation.y = ry;
      scene.add(bench);
    });
  }

  // ─────────────────────────────────────────────
  // محیط پویا — پرنده‌ها و فواره (همیشه روز)
  // ─────────────────────────────────────────────
  function _updateEnvironment(delta) {
    // پرنده‌ها
    const now = performance.now() * 0.001;
    birdFlocks.forEach(flock => {
      flock.children.forEach(bird => {
        const u = bird.userData;
        u.ang += u.spd * delta;
        bird.position.set(
          Math.cos(u.ang) * u.r,
          u.h + Math.sin(u.ang * 2.3) * 2,
          Math.sin(u.ang) * u.r
        );
        bird.rotation.y = -u.ang + Math.PI / 2;
        const flap = Math.sin(now * 9 + u.phase) * 0.7;
        u.wl.rotation.z = flap;
        u.wr.rotation.z = -flap;
      });
    });

    // فواره
    if (fountainRef && fountainOn) {
      const jet = fountainRef.getObjectByName('jet');
      if (jet) {
        const p = 1 + Math.sin(now * 6) * 0.08;
        jet.scale.set(p, 1 + Math.sin(now * 9) * 0.1, p);
      }
      const water = fountainRef.getObjectByName('water');
      if (water) water.position.y = 0.72 + Math.sin(now * 2) * 0.02;
    }

    // پرچم پلیس در باد
    if (_policeFlagRef) {
      _policeFlagRef.rotation.y = Math.sin(now * 3) * 0.25;
      _policeFlagRef.scale.x = 1 + Math.sin(now * 6) * 0.06;
    }

    // چراغ گردان ماشین‌های پلیس — قرمز/آبی متناوب
    for (const st of policeStations) {
      const swap = Math.floor(now * 4) % 2 === 0;
      st.lightBars.forEach(({ redL, bluL }) => {
        redL.material.emissiveIntensity = swap ? 2 : 0.15;
        bluL.material.emissiveIntensity = swap ? 0.15 : 2;
      });
    }

    // بیکن قرمز بلندترین برج‌ها
    if (_skyscraperBeacons) {
      const on = Math.sin(now * 3) > 0;
      _skyscraperBeacons.forEach(b => { b.visible = on; });
    }
  }

  // ─────────────────────────────────────────────
  // ساخت Sprite متن
  // ─────────────────────────────────────────────
  function _makeTextSprite(text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // پس‌زمینه شفاف با rounded rect
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    _roundRect(ctx, 8, 8, 496, 112, 16);
    ctx.fill();

    // متن
    ctx.fillStyle = color || '#ffffff';
    ctx.font = 'bold 42px Vazirmatn, Tahoma, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.fillText(text, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    return new THREE.Sprite(material);
  }

  function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ─────────────────────────────────────────────
  // بررسی دسترسی نقش
  // ─────────────────────────────────────────────
  function _isAccessible(cfg) {
    if (!cfg.role) return true;
    return cfg.role.includes(currentUserRole);
  }

  // ─────────────────────────────────────────────
  // رویدادهای کیبورد
  // ─────────────────────────────────────────────
  function _bindEvents(container) {
    _onKeyDown = (e) => {
      if (e.key in keys) { keys[e.key] = true; e.preventDefault(); }

      // ورود به ساختمان (فقط پیاده — Enter)
      if (e.key === 'Enter' && nearBuilding && !inCar && !inTank && !inHeli && !dialogOpen) {
        _enterBuilding(nearBuilding);
      }

      // F = سوار/پیاده ماشین
      if (e.key === 'f' || e.key === 'F') {
        if (!inCar && !inTank && !inHeli && nearCar)  _mountCar();
        else if (inCar)                               _unmountCar();
      }

      // T = سوار/پیاده تانک
      if (e.key === 't' || e.key === 'T') {
        if (!inTank && !inCar && !inHeli && nearTank)  _mountTank();
        else if (inTank)                               _unmountTank();
      }

      // J = سوار جنگنده / فرود خودکار
      if (e.key === 'j' || e.key === 'J') {
        if (!inJet && !inCar && !inTank && !inHeli && nearJet && jetState === 'parked')  _mountJet();
        else if (inJet)                                                                   _requestJetLand();
      }

      // E = گفتگو با NPC نزدیک / بستن دیالوگ
      if (e.key === 'e' || e.key === 'E') {
        if (dialogOpen)              _closeDialog();
        else if (nearNPC && !inCar && !inTank && !inHeli && !inJet) _openDialog(nearNPC);
      }

      // Esc = بستن دیالوگ
      if (e.key === 'Escape' && dialogOpen) _closeDialog();

      // G = سگ: نشستن / دنبالم
      if (e.key === 'g' || e.key === 'G') {
        dogSit = !dogSit;
        _showToast(dogSit ? '🐕 نشست! صبر می‌کنه' : '🐕 بیا دنبالم!');
      }

      // V = روشن/خاموش کردن فواره پارک
      if (e.key === 'v' || e.key === 'V') {
        if (!fountainRef || Math.abs(character.position.x - 20) > 12 ||
            Math.abs(character.position.z - 20) > 12) {
          if (fountainOn) _showToast('ℹ️ باید نزدیک فواره باشی (پارک اصلی)');
        } else {
          fountainOn = !fountainOn;
          _showToast(fountainOn ? '⛲ فواره روشن شد' : '💧 فواره خاموش شد');
        }
      }

      // H = سوار شدن به هلی‌کوپتر / فرود خودکار
      if (e.key === 'h' || e.key === 'H') {
        if (!inHeli && !inCar && !inTank && nearHeli && heliState === 'landed')  _mountHelicopter();
        else if (inHeli)                                                          _requestHeliLand();
      }

      // R = نمای اول شخص / سوم شخص
      if (e.key === 'r' || e.key === 'R') {
        if (!inHeli) _toggleCameraMode();
      }
    };
    _listen(window, 'keydown', _onKeyDown);

    _onKeyUp = (e) => {
      if (e.key in keys) keys[e.key] = false;
    };
    _listen(window, 'keyup', _onKeyUp);

    // ─── موس: نگاه کردن + شلیک ───────────────
    _onClick = (e) => {
      // درخواست pointer lock برای نگاه با موس
      if (document.pointerLockElement !== container) {
        container.requestPointerLock();
        return;
      }
      // شلیک فقط داخل تانک، هلی‌کوپتر یا جنگنده
      if (!inTank && !inHeli && !inJet) {
        if (!dialogOpen) _showToast('🔒 برای شلیک داخل تانک، هلی‌کوپتر یا جنگنده باشید');
        return;
      }
      _shoot(inTank); // تانک = گلوله انفجاری
    };
    _listen(container, 'click', _onClick);

    _onCtx = (e) => {
      // کلیک راست فقط برای نشانه‌گیری — منو باز نشه
      e.preventDefault();
    };
    _listen(container, 'contextmenu', _onCtx);

    // ─── نشانه‌گیری: نگه داشتن کلیک راست ───
    _onAimDown = (e) => {
      if (e.button === 2) {
        e.preventDefault();
        isAiming = true;
        // اسلحه وسط صفحه موقع نشانه‌گیری
        if (weapon) {
          weapon.position.set(0, -0.15, -0.6);
          weapon.rotation.y = 0;
        }
      }
    };
    _listen(container, 'mousedown', _onAimDown);

    _onAimUp = (e) => {
      if (e.button === 2) {
        isAiming = false;
        if (weapon) {
          weapon.position.set(0.35, -0.28, -0.6);
          weapon.rotation.y = -0.05;
        }
      }
    };
    _listen(window, 'mouseup', _onAimUp);

    // ─── pointer lock: حرکت دوربین با موس ───
    _onMove = (e) => {
      if (document.pointerLockElement !== container) return;
      const sens = isAiming ? 0.001 : 0.002; // موقع نشانه‌گیری حساسیت کمتر

      if (!inCar && !inTank && !inHeli) {
        // پیاده: موس زاویه دید رو کامل کنترل می‌کنه
        viewYaw   -= e.movementX * sens;
        viewPitch += e.movementY * sens * 0.9;
        viewPitch = Math.max(0.03, Math.min(1.25, viewPitch));
      } else {
        // داخل وسیله: موس وسیله رو می‌چرخونه + زاویه دوربین
        const target = inJet ? fighterJet : inHeli ? helicopter : inTank ? tank : carMesh;
        if (target && !dialogOpen) target.rotation.y -= e.movementX * sens;
        viewPitch += e.movementY * sens * 0.9;
        viewPitch = Math.max(0.03, Math.min(1.1, viewPitch));
      }
    };
    _listen(document, 'mousemove', _onMove);

    _onPlc = () => {
      const locked = document.pointerLockElement === container;
      const hint = document.getElementById('city-pointer-hint');
      if (hint) hint.style.display = locked ? 'none' : 'flex';
    };
    _listen(document, 'pointerlockchange', _onPlc);

    // ─── موبایل: لمس ───────────────────────
    _bindTouchJoystick();
  }

  // ─── toggle حالت دوربین ───────────────────
  let _firstPerson = false;
  function _toggleCameraMode() {
    _firstPerson = !_firstPerson;
    _showToast(_firstPerson ? '👁 دوربین اول شخص' : '📷 دوربین سوم شخص');
  }

  // ─────────────────────────────────────────────
  // Joystick موبایل
  // ─────────────────────────────────────────────
  let joystickActive = false;
  let joystickOrigin = { x: 0, y: 0 };
  let joystickDelta = { x: 0, y: 0 };

  function _bindTouchJoystick() {
    const joystick = document.getElementById('city-joystick');
    if (!joystick) return;

    joystick.addEventListener('touchstart', e => {
      joystickActive = true;
      const t = e.touches[0];
      joystickOrigin = { x: t.clientX, y: t.clientY };
      joystickDelta = { x: 0, y: 0 };
      e.preventDefault();
    }, { passive: false });

    joystick.addEventListener('touchmove', e => {
      if (!joystickActive) return;
      const t = e.touches[0];
      joystickDelta.x = (t.clientX - joystickOrigin.x) / 50;
      joystickDelta.y = (t.clientY - joystickOrigin.y) / 50;
      joystickDelta.x = Math.max(-1, Math.min(1, joystickDelta.x));
      joystickDelta.y = Math.max(-1, Math.min(1, joystickDelta.y));
      // نمایش بصری knob
      const knob = document.getElementById('city-joystick-knob');
      if (knob) {
        knob.style.transform = `translate(${joystickDelta.x * 30}px, ${joystickDelta.y * 30}px)`;
      }
      e.preventDefault();
    }, { passive: false });

    joystick.addEventListener('touchend', () => {
      joystickActive = false;
      joystickDelta = { x: 0, y: 0 };
      const knob = document.getElementById('city-joystick-knob');
      if (knob) knob.style.transform = 'translate(0,0)';
    });  }

  // ─────────────────────────────────────────────
  // سوار شدن به ماشین
  // ─────────────────────────────────────────────
  function _mountCar() {
    inCar = true;
    carVelocity = 0;
    // مخفی کردن کاراکتر داخل ماشین
    character.visible = false;
    // مخفی کردن label ماشین
    const lbl = carMesh.getObjectByName('carLabel');
    if (lbl) lbl.visible = false;
    _showToast('🚗 داخل ماشین هستید — WASD برای حرکت، F برای پیاده شدن');
    // آپدیت HUD
    const hint = document.getElementById('city-controls-hint');
    if (hint) hint.innerHTML = `
      <p><span class="key">W</span><span class="key">S</span> — گاز / ترمز</p>
      <p><span class="key">A</span><span class="key">D</span> — فرمان</p>
      <p><span class="key">F</span> — پیاده شدن</p>
    `;
  }

  // ─────────────────────────────────────────────
  // پیاده شدن از ماشین
  // ─────────────────────────────────────────────
  function _unmountCar() {
    inCar = false;
    carVelocity = 0;
    character.visible = true;
    // کاراکتر رو کنار ماشین بذار
    const side = new THREE.Vector3(
      Math.cos(carMesh.rotation.y) * 2.5,
      0,
      -Math.sin(carMesh.rotation.y) * 2.5
    );
    character.position.set(
      carMesh.position.x + side.x,
      0,
      carMesh.position.z + side.z
    );
    character.rotation.y = carMesh.rotation.y;
    // نشون دادن label ماشین
    const lbl = carMesh.getObjectByName('carLabel');
    if (lbl) lbl.visible = true;
    _showToast('🚶 پیاده شدید');
    _resetControlsHint();
    // ریست HUD
  }

  // راهنمای پیش‌فرض کنترل‌ها
  function _resetControlsHint() {
    const hint = document.getElementById('city-controls-hint');
    if (hint) hint.innerHTML = `
      <p><span class="key">W</span><span class="key">A</span><span class="key">S</span><span class="key">D</span> یا فلش‌ها — حرکت (<span class="key">Shift</span> دویدن)</p>
      <p><span class="key">Space</span> — پرش · <span class="key">E</span> — گفتگو با NPC</p>
      <p><span class="key">G</span> سگ · <span class="key">V</span> فواره · ⚽ توپ را هل بده!</p>
      <p><span class="key">F</span> ماشین · <span class="key">T</span> تانک · <span class="key">H</span> هلی · <span class="key">J</span> جنگنده (بیس هوایی)</p>
      <p>📍 به در ساختمان نزدیک شوید</p>
    `;
  }

  // ─────────────────────────────────────────────
  // ورود به ساختمان
  // ─────────────────────────────────────────────
  function _enterBuilding(building) {
    if (!building.accessible) {
      _showToast('❌ دسترسی به این بخش برای شما فعال نیست');
      return;
    }
    _showToast('⏳ در حال ورود به ' + building.config.label + '...');
    // انیمیشن کوتاه قبل از تغییر صفحه
    setTimeout(() => {
      if (onPageChange) onPageChange(building.config.page);
    }, 600);
  }

  // ─────────────────────────────────────────────
  // نمایش نوتیف کوتاه
  // ─────────────────────────────────────────────
  function _showToast(msg) {
    const el = document.getElementById('city-toast');
    if (!el) return;
    el.textContent = msg;
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-10px)';
    }, 2500);
  }

  // ─────────────────────────────────────────────
  // حلقه انیمیشن اصلی
  // ─────────────────────────────────────────────
  function _animate() {
    if (!_running) return;
    requestAnimationFrame(_animate);
    const delta = Math.min(clock.getDelta(), 0.05); // cap برای جلوگیری از جهش

    // حرکت کاراکتر / ماشین / تانک / هلی‌کوپتر
    _updateMovement(delta);

    // NPC
    _updateNPCs(delta);

    // ترافیک، عابرها، سگ، فیزیک
    _updateTraffic(delta);
    _updatePedestrians(delta);
    _updateDog(delta);
    _updatePhysics(delta);

    // هلی‌کوپتر
    _updateHelicopter(delta);

    // جنگنده
    _updateJet(delta);

    // گلوله‌ها
    _updateBullets(delta);

    // دود
    _updateSmoke(delta);

    // محیط: شب و روز، پرنده‌ها، فواره
    _updateEnvironment(delta);

    // اسلحه/کراسهیر فقط داخل وسیله جنگی
    _updateCombatHUD();

    // بررسی نزدیکی به ساختمان / ماشین / تانک
    _checkProximity();

    // حرکت ابرها
    scene.children.forEach(obj => {
      if (obj.userData.cloudDrift) {
        obj.position.x += obj.userData.cloudDrift;
        if (obj.position.x > 180) obj.position.x = -180;
        if (obj.position.x < -180) obj.position.x = 180;
      }
    });

    // دوربین سوم شخص
    _updateCamera();

    // sprite ها رو به دوربین نگاه کنن
    labels.forEach(s => s.lookAt(camera.position));
    // NPC label ها هم
    npcs.forEach(npc => npc.children.filter(c => c.isSprite).forEach(s => s.lookAt(camera.position)));

    renderer.render(scene, camera);

    // آپدیت minimap
    _updateMinimap();
  }

  // ─────────────────────────────────────────────
  // حرکت کاراکتر یا ماشین
  // ─────────────────────────────────────────────
  function _updateMovement(delta) {
    if (inJet)       { /* پرواز جت در _updateJet */ }
    else if (inHeli) _updateHelicopterFlight(delta);
    else if (inTank) _updateTank(delta);
    else if (inCar)  _updateCarMovement(delta);
    else if (!dialogOpen) _updateCharacterMovement(delta);
  }

  // حرکت ماشین
  function _updateCarMovement(delta) {
    const forward = keys.w || keys.ArrowUp;
    const backward = keys.s || keys.ArrowDown;
    const turnLeft = keys.a || keys.ArrowLeft;
    const turnRight = keys.d || keys.ArrowRight;

    // شتاب و ترمز
    if (forward)  carVelocity = Math.min(carVelocity + 18 * delta, CAR_SPEED);
    else if (backward) carVelocity = Math.max(carVelocity - 18 * delta, -CAR_SPEED * 0.5);
    else {
      // اصطکاک
      carVelocity *= (1 - 3.5 * delta);
      if (Math.abs(carVelocity) < 0.05) carVelocity = 0;
    }

    // فرمان فقط وقتی ماشین حرکت می‌کنه
    if (Math.abs(carVelocity) > 0.2) {
      const dir = carVelocity > 0 ? 1 : -1;
      if (turnLeft)  carMesh.rotation.y += CAR_TURN_SPEED * delta * dir;
      if (turnRight) carMesh.rotation.y -= CAR_TURN_SPEED * delta * dir;
    }

    // حرکت
    if (Math.abs(carVelocity) > 0.01) {
      const nx = carMesh.position.x + Math.sin(carMesh.rotation.y) * carVelocity * delta;
      const nz = carMesh.position.z + Math.cos(carMesh.rotation.y) * carVelocity * delta;

      // برخورد ماشین با ساختمان
      if (!_collidesLarge(nx, nz, 2.5, 3.0)) {
        carMesh.position.x = nx;
        carMesh.position.z = nz;
      } else {
        carVelocity *= -0.3; // جهش برگشت
      }

      // باند جهان — بزرگ‌تر برای شهر جدید
      carMesh.position.x = Math.max(-WORLD_EDGE, Math.min(WORLD_EDGE, carMesh.position.x));
      carMesh.position.z = Math.max(-WORLD_EDGE, Math.min(WORLD_EDGE, carMesh.position.z));

      // چرخش لاستیک‌ها + فرمان چرخ‌های جلو
      const wheelTurn = carVelocity * delta * 2.2;
      const wheels = carMesh.userData.wheels || [];
      wheels.forEach(w => { if (w.children[0]) w.children[0].rotation.x += wheelTurn; });

      const steerIn = ((keys.a || keys.ArrowLeft) ? 1 : 0) - ((keys.d || keys.ArrowRight) ? 1 : 0);
      carMesh.userData.steer = (carMesh.userData.steer || 0) +
        (steerIn * 0.38 - (carMesh.userData.steer || 0)) * Math.min(1, delta * 8);
      if (wheels[0]) wheels[0].rotation.y = carMesh.userData.steer;
      if (wheels[1]) wheels[1].rotation.y = carMesh.userData.steer;
    }
  }

  // حرکت کاراکتر پیاده — نسبت به زاویه دید دوربین
  function _updateCharacterMovement(delta) {
    let fwdI = 0, rightI = 0;
    if (keys.w || keys.ArrowUp)    fwdI += 1;   // W = جلو
    if (keys.s || keys.ArrowDown)  fwdI -= 1;   // S = عقب
    if (keys.d || keys.ArrowRight) rightI += 1; // D = راست
    if (keys.a || keys.ArrowLeft)  rightI -= 1; // A = چپ

    if (joystickActive) {
      if (joystickDelta.y < -0.2) fwdI += 1;
      if (joystickDelta.y >  0.2) fwdI -= 1;
      if (joystickDelta.x >  0.2) rightI += 1;
      if (joystickDelta.x < -0.2) rightI -= 1;
    }

    const running = !!keys.Shift && !joystickActive && fwdI > 0;
    const speed = MOVE_SPEED * (running ? RUN_MULT : 1) * delta;
    const limbs = character.userData.limbs;
    let animT = null;

    if (fwdI !== 0 || rightI !== 0) {
      const sv = Math.sin(viewYaw), cv = Math.cos(viewYaw);
      // جلو = خلاف جهتی که دوربین قرار داره
      const worldX = fwdI * -sv + rightI * cv;
      const worldZ = fwdI * -cv + rightI * -sv;

      const newX = character.position.x + worldX * speed;
      const newZ = character.position.z + worldZ * speed;

      if (!_collides(newX, newZ)) {
        character.position.x = newX;
        character.position.z = newZ;
      }

      // چرخش نرم به سمت حرکت
      const targetAngle = Math.atan2(worldX, worldZ);
      let diff = targetAngle - character.rotation.y;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      character.rotation.y += diff * Math.min(1, delta * 12);

      character.position.x = Math.max(-WORLD_EDGE, Math.min(WORLD_EDGE, character.position.x));
      character.position.z = Math.max(-WORLD_EDGE, Math.min(WORLD_EDGE, character.position.z));

      animT = performance.now() * 0.001 * (running ? 13 : 8);
    }
    // پرش با Space
    if (keys[' '] && character.position.y <= 0.01 && vertVel === 0) {
      vertVel = JUMP_SPEED;
    }
    // گرانش
    if (character.position.y > 0 || vertVel > 0) {
      vertVel += GRAVITY * delta;
      character.position.y += vertVel * delta;
      if (character.position.y <= 0) {
        character.position.y = 0;
        vertVel = 0;
        // نشستن زانو هنگام فرود
        if (limbs) limbs.legs.forEach(l => { l.rotation.x = 0.5; });
      }
    }

    // انیمیشن راه رفتن — اسکلت کامل (ران/زانو/شانه/آرنج)
    if (limbs) {
      if (animT !== null) {
        _animHumanoid(character, animT, running ? 0.85 : 0.55);
      } else if (character.position.y <= 0.01 && vertVel === 0) {
        const decay = Math.min(1, delta * 10);
        (limbs.all || []).forEach(p => {
          p.rotation.x *= (1 - decay);
          p.rotation.z *= (1 - Math.min(1, delta * 2));
        });
        if (limbs.headGrp) limbs.headGrp.rotation.y *= (1 - decay);
        if (limbs.torso) limbs.torso.rotation.x *= (1 - decay);
        character.position.y = 0;
      }
    }
  }

  // ─────────────────────────────────────────────
  // برخورد (collision) ساده — پیاده
  // ─────────────────────────────────────────────
  function _collides(nx, nz) {
    for (const b of buildings) {
      const { position, width, depth } = b.config;
      const margin = 0.6;
      const halfW = width / 2 + margin;
      const halfD = depth / 2 + margin;
      if (
        nx > position.x - halfW && nx < position.x + halfW &&
        nz > position.z - halfD && nz < position.z + halfD
      ) return true;
    }
    for (const c of staticColliders) {
      if (c.onlyWhenParked && jetState !== 'parked') continue;
      if (nx > c.x - c.hw && nx < c.x + c.hw && nz > c.z - c.hd && nz < c.z + c.hd) return true;
    }
    return false;
  }

  // برخورد با margin بزرگتر — برای ماشین
  function _collidesLarge(nx, nz, mw, md) {
    for (const b of buildings) {
      const { position, width, depth } = b.config;  
      const halfW = width  / 2 + mw;
      const halfD = depth  / 2 + md;
      if (
        nx > position.x - halfW && nx < position.x + halfW &&
        nz > position.z - halfD && nz < position.z + halfD
      ) return true;
    }
    for (const c of staticColliders) {
      if (c.onlyWhenParked && jetState !== 'parked') continue;
      if (nx > c.x - c.hw - mw && nx < c.x + c.hw + mw && nz > c.z - c.hd - md && nz < c.z + c.hd + md) return true;
    }
    return false;
  }

  // ─────────────────────────────────────────────
  // بررسی نزدیکی به ساختمان و ماشین
  // ─────────────────────────────────────────────
  function _checkProximity() {
    // ─── فقط پیاده: بررسی نزدیکی ساختمان ───
    if (!inCar && !inTank) {
      let closest = null;
      let closestDist = Infinity;

      buildings.forEach(b => {
        const dx = character.position.x - b.config.position.x;
        const dz = character.position.z - b.config.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < closestDist) { closestDist = dist; closest = { building: b, dist }; }

        // ریست هایلایت
        if (b.isHighlighted) {
          b.body.material.emissive.set(0x000000);
          b.body.material.emissiveIntensity = 0;
          b.isHighlighted = false;
        }
      });

      if (closest && closest.dist < ENTER_DISTANCE) {
        nearBuilding = closest.building;
        nearBuilding.body.material.emissive.set(0xffffff);
        nearBuilding.body.material.emissiveIntensity = 0.2 + Math.sin(performance.now() * 0.005) * 0.1;
        nearBuilding.isHighlighted = true;

        const enterEl = document.getElementById('city-enter-prompt');
        if (enterEl) {
          enterEl.innerHTML = nearBuilding.accessible
            ? `<span>🚪 ورود به <strong>${nearBuilding.config.label}</strong> — Enter</span>`
            : `<span>🔒 دسترسی محدود است</span>`;
          enterEl.style.opacity = '1';
        }
      } else {
        nearBuilding = null;
        const enterEl = document.getElementById('city-enter-prompt');
        if (enterEl) enterEl.style.opacity = '0';
      }

      // ─── بررسی نزدیکی ماشین ───
      if (carMesh) {
        const cdx = character.position.x - carMesh.position.x;
        const cdz = character.position.z - carMesh.position.z;
        const carDist = Math.sqrt(cdx * cdx + cdz * cdz);
        const wasNear = nearCar;
        nearCar = carDist < ENTER_CAR_DIST;

        if (nearCar && !wasNear) {
          // تازه نزدیک شد — اگه ساختمانی نزدیک نیست پیام ماشین نشون بده
          if (!nearBuilding) {
            const enterEl = document.getElementById('city-enter-prompt');
            if (enterEl) {
              enterEl.innerHTML = `<span>🚗 برای سوار شدن <strong>F</strong> بزنید</span>`;
              enterEl.style.opacity = '1';
            }
          }
        } else if (!nearCar && wasNear && !nearBuilding) {
          const enterEl = document.getElementById('city-enter-prompt');
          if (enterEl) enterEl.style.opacity = '0';
        }

        // آپدیت پیام وقتی نزدیک ماشینه و ساختمان نیست
        if (nearCar && !nearBuilding) {
          const enterEl = document.getElementById('city-enter-prompt');
          if (enterEl) {
            enterEl.innerHTML = `<span>🚗 برای سوار شدن <strong>F</strong> بزنید</span>`;
            enterEl.style.opacity = '1';
          }
        }
      }

      // ─── بررسی نزدیکی تانک ───
      if (tank) {
        const tdx = character.position.x - tank.position.x;
        const tdz = character.position.z - tank.position.z;
        const tankDist = Math.sqrt(tdx * tdx + tdz * tdz);
        const wasNearTank = nearTank;
        nearTank = tankDist < ENTER_TANK_DIST;

        if (nearTank && !nearBuilding && !nearCar) {
          const enterEl = document.getElementById('city-enter-prompt');
          if (enterEl) {
            enterEl.innerHTML = `<span>🪖 برای سوار شدن به تانک <strong>T</strong> بزنید</span>`;
            enterEl.style.opacity = '1';
          }
        } else if (!nearTank && wasNearTank && !nearBuilding && !nearCar) {
          const enterEl = document.getElementById('city-enter-prompt');
          if (enterEl) enterEl.style.opacity = '0';
        }
      }

      // ─── بررسی نزدیکی هلی‌کوپتر ───
      if (helicopter) {
        const hdx = character.position.x - helicopter.position.x;
        const hdz = character.position.z - helicopter.position.z;
        nearHeli = Math.sqrt(hdx * hdx + hdz * hdz) < HELI_ENTER_DIST;

        if (nearHeli && !nearBuilding && !nearCar && !nearTank) {
          const enterEl = document.getElementById('city-enter-prompt');
          if (enterEl) {
            enterEl.innerHTML = heliState === 'landed'
              ? `<span>🚁 برای سوار شدن به هلی‌کوپتر <strong>H</strong> بزنید</span>`
              : `<span>🚁 در حال فرود...</span>`;
            enterEl.style.opacity = '1';
          }
        } else if (!nearHeli && heliState === 'landed' && !nearBuilding && !nearCar && !nearTank) {
          const enterEl = document.getElementById('city-enter-prompt');
          if (enterEl && enterEl.innerHTML.includes('هلی')) enterEl.style.opacity = '0';
        }
      }

      // ─── بررسی نزدیکی جنگنده ───
      if (fighterJet) {
        const jdx = character.position.x - fighterJet.position.x;
        const jdz = character.position.z - fighterJet.position.z;
        nearJet = Math.sqrt(jdx * jdx + jdz * jdz) < 8;

        const enterEl = document.getElementById('city-enter-prompt');
        if (nearJet && jetState === 'parked' && !nearBuilding && !nearCar && !nearTank && !nearHeli) {
          if (enterEl) {
            enterEl.innerHTML = `<span>✈️ برای سوار شدن به جنگنده <strong>J</strong> بزنید</span>`;
            enterEl.style.opacity = '1';
          }
        } else if (!nearJet && enterEl && enterEl.innerHTML.includes('جنگنده')) {
          enterEl.style.opacity = '0';
        }
      }

      // ─── بررسی نزدیکی NPC برای گفتگو ───
      nearNPC = null;
      let bestDist = 3.6;
      npcs.forEach(npc => {
        if (!npc.visible || npc.userData.state === 'dead') return;
        const dx = npc.position.x - character.position.x;
        const dz = npc.position.z - character.position.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < bestDist) { bestDist = d; nearNPC = npc; }
      });

      if (nearNPC && !dialogOpen && !nearBuilding && !nearCar && !nearTank && !nearHeli && !nearJet) {
        const enterEl = document.getElementById('city-enter-prompt');
        if (enterEl) {
          enterEl.innerHTML = `<span>� ثبت وظیفه برای <strong>${nearNPC.userData.name}</strong> — E</span>`;
          enterEl.style.opacity = '1';
        }
      } else if (!nearNPC) {
        const enterEl = document.getElementById('city-enter-prompt');
        if (enterEl && enterEl.innerHTML.includes('گفتگو')) enterEl.style.opacity = '0';
      }

    } else {
      // ─── داخل وسیله: فقط ریست ساختمان‌ها و نزدیکی ───
      nearBuilding = null;
      nearCar = false;
      nearTank = false;
      nearHeli = false;
      nearJet = false;
      nearNPC = null;
      joystickActive = false;
      buildings.forEach(b => {
        if (b.isHighlighted) {
          b.body.material.emissive.set(0x000000);
          b.body.material.emissiveIntensity = 0;
          b.isHighlighted = false;
        }
      });
      const enterEl = document.getElementById('city-enter-prompt');
      if (enterEl) enterEl.style.opacity = '0';
    }
  }

  // ─────────────────────────────────────────────
  // دوربین سوم شخص — پیاده یا ماشین
  // ─────────────────────────────────────────────
  function _updateCamera() {
    if (inJet && fighterJet) {
      // دوربین تعقیبی پشت جت — با سرعت دورتر
      const jyaw = fighterJet.rotation.y;
      const back = 15 + jetSpeed * 0.1;
      const up = 4.5 + viewPitch * 8;
      const tx = fighterJet.position.x - Math.sin(jyaw) * back;
      const ty = fighterJet.position.y + up;
      const tz = fighterJet.position.z - Math.cos(jyaw) * back;
      camera.position.x += (tx - camera.position.x) * 0.09;
      camera.position.y += (ty - camera.position.y) * 0.09;
      camera.position.z += (tz - camera.position.z) * 0.09;
      camera.lookAt(
        fighterJet.position.x + Math.sin(jyaw) * 6,
        fighterJet.position.y + 1,
        fighterJet.position.z + Math.cos(jyaw) * 6
      );
    } else if (inHeli && helicopter) {
      // دوربین پشت و بالای هلی‌کوپتر
      const dist = 22, height = 9 + viewPitch * 11;
      const tx = helicopter.position.x - Math.sin(helicopter.rotation.y) * dist;
      const ty = helicopter.position.y + height;
      const tz = helicopter.position.z - Math.cos(helicopter.rotation.y) * dist;
      camera.position.x += (tx - camera.position.x) * 0.06;
      camera.position.y += (ty - camera.position.y) * 0.06;
      camera.position.z += (tz - camera.position.z) * 0.06;
      camera.lookAt(helicopter.position.x, helicopter.position.y, helicopter.position.z);
    } else if (inTank && tank) {
      // دوربین پشت تانک — ارتفاع با pitch موس
      const dist = 18;
      const height = 8 + viewPitch * 9;
      const targetX = tank.position.x - Math.sin(tank.rotation.y) * dist;
      const targetY = tank.position.y + height;
      const targetZ = tank.position.z - Math.cos(tank.rotation.y) * dist;
      camera.position.x += (targetX - camera.position.x) * 0.08;
      camera.position.y += (targetY - camera.position.y) * 0.08;
      camera.position.z += (targetZ - camera.position.z) * 0.08;
      camera.lookAt(tank.position.x, tank.position.y + 2, tank.position.z);
    } else if (inCar) {
      // دوربین پشت ماشین — ارتفاع با pitch موس
      const dist = 14;
      const height = 6 + viewPitch * 7;
      const targetX = carMesh.position.x - Math.sin(carMesh.rotation.y) * dist;
      const targetY = carMesh.position.y + height;
      const targetZ = carMesh.position.z - Math.cos(carMesh.rotation.y) * dist;

      camera.position.x += (targetX - camera.position.x) * 0.1;
      camera.position.y += (targetY - camera.position.y) * 0.1;
      camera.position.z += (targetZ - camera.position.z) * 0.1;

      camera.lookAt(
        carMesh.position.x,
        carMesh.position.y + 1.5,
        carMesh.position.z
      );
    } else {
      // ─── دوربین پیاده — مداری با موس ───
      const limbsRef = character.userData.limbs;
      if (_firstPerson) {
        // اول شخص — دوربین داخل چشم‌ها
        if (limbsRef && limbsRef.headGrp) limbsRef.headGrp.visible = false;
        const eyeY = character.position.y + 1.9;
        const cp = Math.cos(viewPitch);
        camera.position.set(character.position.x, eyeY, character.position.z);
        camera.lookAt(
          character.position.x - Math.sin(viewYaw) * cp,
          eyeY + Math.sin(viewPitch),
          character.position.z - Math.cos(viewYaw) * cp
        );
      } else {
        if (limbsRef && limbsRef.headGrp) limbsRef.headGrp.visible = true;
        // سوم شخص — مدار حول کاراکتر با yaw/pitch موس
        const d = 12;
        const cp = Math.cos(viewPitch), sp = Math.sin(viewPitch);
        const tx = character.position.x + Math.sin(viewYaw) * d * cp;
        const ty = Math.max(0.8, character.position.y + 1.6 + sp * d);
        const tz = character.position.z + Math.cos(viewYaw) * d * cp;
        camera.position.x += (tx - camera.position.x) * 0.14;
        camera.position.y += (ty - camera.position.y) * 0.14;
        camera.position.z += (tz - camera.position.z) * 0.14;
        camera.lookAt(character.position.x, character.position.y + 1.5, character.position.z);
      }
    }

    // ─── زوم نشانه‌گیری (FOV) + افکت سرعت جت ───
    let targetFov = 60;
    if (inJet) targetFov = 62 + (jetSpeed / JET_MAX_SPD) * 18;
    if (isAiming && (inTank || inHeli || inJet)) targetFov = 42;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, 0.18);
      camera.updateProjectionMatrix();
    }
  }

  // HUD حالت رزم — اسلحه/کراسهیر فقط داخل تانک، هلی یا جت
  function _updateCombatHUD() {
    const combat = !!(inTank || inHeli || inJet);
    if (weapon && weapon.visible !== combat) weapon.visible = combat;
    const ch = document.getElementById('city-crosshair');
    if (ch) {
      ch.style.display = combat ? 'block' : 'none';
      ch.style.transform = isAiming
        ? 'translate(-50%,-50%) scale(0.7)'
        : 'translate(-50%,-50%) scale(1)';
    }
    const st = document.getElementById('city-weapon-stats');
    if (st) st.style.display = combat ? 'block' : 'none';
  }

  // ─────────────────────────────────────────────
  // بیس هوایی — باند فرود + جت جنگنده (شرق شهر)
  // ─────────────────────────────────────────────
  function _buildAirbase() {
    const g = new THREE.Group();

    const stripeM = new THREE.MeshBasicMaterial({ color: 0xe5e7eb });

    // ─── باند اصلی ───
    const runway = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 140),
      new THREE.MeshPhongMaterial({ color: 0x2b2f36 })
    );
    runway.rotation.x = -Math.PI / 2;
    runway.position.set(0, 0.03, 0);
    runway.receiveShadow = true;
    g.add(runway);

    // خط‌کشی مرکزی
    for (let i = -62; i <= 62; i += 11) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 5), stripeM);
      s.rotation.x = -Math.PI / 2;
      s.position.set(0, 0.04, i);
      g.add(s);
    }

    // علامت‌های آستانه باند
    for (let i = 0; i < 6; i++) {
      const t = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 8), stripeM);
      t.rotation.x = -Math.PI / 2;
      t.position.set(-6 + i * 2.4, 0.045, 66);
      g.add(t);
      const t2 = t.clone();
      t2.position.z = -66;
      g.add(t2);
    }

    // چراغ‌های لبه باند
    const edgeM = new THREE.MeshBasicMaterial({ color: 0xbfdbfe });
    for (let i = -68; i <= 68; i += 12) {
      [-8.5, 8.5].forEach(x => {
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), edgeM);
        l.position.set(x, 0.25, i);
        g.add(l);
      });
    }

    // ─── سکوی پارک + تاکسی‌وی ───
    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 28),
      new THREE.MeshPhongMaterial({ color: 0x3a3f47 })
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(-23, 0.03, 22);
    apron.receiveShadow = true;
    g.add(apron);

    const taxiway = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 10),
      new THREE.MeshPhongMaterial({ color: 0x33373e })
    );
    taxiway.rotation.x = -Math.PI / 2;
    taxiway.position.set(-12, 0.03, 22);
    g.add(taxiway);

    // خط زرد تاکسی‌وی
    const yl = new THREE.Mesh(new THREE.PlaneGeometry(14, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
    yl.rotation.x = -Math.PI / 2;
    yl.position.set(-12, 0.045, 22);
    g.add(yl);

    // ─── جت جنگنده — مستقیم در صحنه برای مختصات جهانی ───
    fighterJet = _makeFighterJet();
    fighterJet.position.set(105, 0, 22);      // روی سکوی پارک
    fighterJet.rotation.y = Math.PI / 2;       // دماغه رو به باند
    scene.add(fighterJet);

    // برچسب‌ها
    const lbl = _makeTextSprite('🛬 باند فرود', '#93c5fd');
    lbl.position.set(0, 9, -45);
    lbl.scale.set(6, 2, 1);
    g.add(lbl);
    labels.push(lbl);

    const jlbl = _makeTextSprite('✈️ جنگنده', '#fca5a5');
    jlbl.position.set(-23, 6, 22);
    jlbl.scale.set(4.5, 1.5, 1);
    g.add(jlbl);
    labels.push(jlbl);

    // شرق شهر — دور از ساختمان‌ها
    g.position.set(128, 0, 0);
    scene.add(g);

    // برخورد با بدنه جت — فقط وقتی پارک شده
    _addCollider(105, 22, 3.2, 6, true);
  }

  function _makeFighterJet() {
    const jet = new THREE.Group();
    const air = new THREE.Group();
    air.position.y = 1.65; // ارتفاع روی ارابه فرود
    jet.add(air);

    const bodyM = new THREE.MeshPhongMaterial({ color: 0x7b8494, shininess: 80 });
    const darkM = new THREE.MeshPhongMaterial({ color: 0x374151 });

    // فیوزلاژ
    const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.5, 6.5, 12), bodyM);
    fus.rotation.x = Math.PI / 2;
    fus.castShadow = true;
    air.add(fus);

    // دماغه
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.72, 2.6, 12), bodyM);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 4.55;
    nose.castShadow = true;
    air.add(nose);

    // کابین شیشه‌ای حبابی
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 12, 10),
      new THREE.MeshPhongMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.6, shininess: 140 })
    );
    canopy.scale.set(0.78, 0.72, 1.8);
    canopy.position.set(0, 0.58, 1.7);
    air.add(canopy);

    [-1, 1].forEach(s => {
      // بال دلتا
      const wing = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.13, 2.8), bodyM);
      wing.position.set(s * 2.75, -0.12, -0.7);
      wing.rotation.y = s * 0.42;
      wing.castShadow = true;
      air.add(wing);

      // زیربال موشک
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.6, 8), darkM);
      pod.rotation.x = Math.PI / 2;
      pod.position.set(s * 3.4, -0.3, 0.4);
      air.add(pod);

      // پایدارکن عمودی
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 1.5), bodyM);
      fin.position.set(s * 0.5, 1.05, -2.95);
      fin.rotation.z = s * -0.3;
      fin.castShadow = true;
      air.add(fin);

      // استابیلایزر افقی
      const stab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 1.15), bodyM);
      stab.position.set(s * 1.25, 0.08, -3.1);
      stab.rotation.y = s * 0.38;
      air.add(stab);
    });

    // نازل موتور
    const noz = new THREE.Mesh(new THREE.ConeGeometry(0.56, 1.3, 10), darkM);
    noz.rotation.x = -Math.PI / 2;
    noz.position.z = -3.85;
    air.add(noz);

    // ارابه فرود سه‌چرخ
    [[0, 3.1], [-1.15, -0.9], [1.15, -0.9]].forEach(([gx, gz]) => {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.75, 6), darkM);
      strut.position.set(gx, -0.85, gz);
      air.add(strut);
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.24, 0.16, 10),
        new THREE.MeshPhongMaterial({ color: 0x111111 })
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(gx, -1.28, gz);
      wheel.castShadow = true;
      air.add(wheel);
    });

    return jet;
  }

  // ─────────────────────────────────────────────
  // پارک بزرگ شهری — برکه، مسیر، درخت، زمین فوتبال
  // ─────────────────────────────────────────────
  function _buildCityPark() {
    const PX = -125, PZ = -118, R = 40;
    const park = new THREE.Group();

    // چمن تیره‌تر
    const grass = new THREE.Mesh(new THREE.CircleGeometry(R, 32),
      new THREE.MeshLambertMaterial({ color: 0x1f9d4f }));
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = 0.02;
    grass.receiveShadow = true;
    park.add(grass);

    // مسیرهای شن‌ریز صلیبی
    const pathM = new THREE.MeshLambertMaterial({ color: 0xc9b48a });
    [[0, 0, 2 * R - 8, 3], [0, 0, 3, 2 * R - 8]].forEach(([px, pz, w, h]) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), pathM);
      p.rotation.x = -Math.PI / 2;
      p.position.set(px, 0.04, pz);
      park.add(p);
    });

    // حلقه مسیر دور برکه
    const ring = new THREE.Mesh(new THREE.RingGeometry(11, 13, 28), pathM);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(-12, 0.04, 10);
    park.add(ring);

    // ─── برکه با سنگ‌چین ───
    const pond = new THREE.Mesh(new THREE.CircleGeometry(10.5, 26),
      new THREE.MeshPhongMaterial({ color: 0x2f86c9, shininess: 140, transparent: true, opacity: 0.9 }));
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(-12, 0.05, 10);
    park.add(pond);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.SphereGeometry(0.5 + Math.random() * 0.25, 6, 5),
        new THREE.MeshLambertMaterial({ color: 0x8d99ae }));
      stone.scale.y = 0.55;
      stone.position.set(-12 + Math.cos(a) * 10.7, 0.15, 10 + Math.sin(a) * 10.7);
      stone.castShadow = true;
      park.add(stone);
    }

    // ─── گل‌کاری‌های رنگی ───
    const flowerColors = [0xef4444, 0xf59e0b, 0xec4899, 0x8b5cf6, 0xffffff];
    for (let bed = 0; bed < 4; bed++) {
      const bx = [-24, 24, -22, 22][bed];
      const bz = [-26, 26, 24, -24][bed];
      const soil = new THREE.Mesh(new THREE.CircleGeometry(3.2, 14),
        new THREE.MeshLambertMaterial({ color: 0x5b4636 }));
      soil.rotation.x = -Math.PI / 2;
      soil.position.set(bx, 0.05, bz);
      park.add(soil);
      for (let f = 0; f < 14; f++) {
        const fl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5),
          new THREE.MeshBasicMaterial({ color: flowerColors[(bed + f) % flowerColors.length] }));
        fl.position.set(bx + (Math.random() - 0.5) * 5, 0.35, bz + (Math.random() - 0.5) * 5);
        park.add(fl);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4),
          new THREE.MeshLambertMaterial({ color: 0x166534 }));
        stem.position.set(fl.position.x, 0.18, fl.position.z);
        park.add(stem);
      }
    }

    // ─── درخت‌های انبوه پارک ───
    for (let i = 0; i < 34; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = 18 + Math.random() * (R - 22);
      const tx = Math.cos(a) * rr, tz = Math.sin(a) * rr;
      if (Math.abs(tx) < 4 || Math.abs(tz) < 4) continue; // روی مسیر نیفتد
      const th = 3 + Math.random() * 2.5;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, th, 7),
        new THREE.MeshLambertMaterial({ color: 0x7c5a3a }));
      trunk.position.set(tx, th / 2, tz);
      trunk.castShadow = true;
      park.add(trunk);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(1.5 + Math.random(), 8, 7),
        new THREE.MeshLambertMaterial({ color: [0x228b22, 0x2d8a3a, 0x1f7a33][i % 3] }));
      crown.position.set(tx, th + 1.1, tz);
      crown.castShadow = true;
      park.add(crown);
    }

    // نیمکت‌ها دور برکه
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      const bench = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 0.55),
        new THREE.MeshPhongMaterial({ color: 0x92400e }));
      seat.position.y = 0.52;
      seat.castShadow = true;
      bench.add(seat);
      const backr = new THREE.Mesh(new THREE.BoxGeometry(2, 0.45, 0.09),
        new THREE.MeshPhongMaterial({ color: 0x92400e }));
      backr.position.set(0, 0.8, -0.24);
      bench.add(backr);
      bench.position.set(-12 + Math.cos(a) * 14.5, 0, 10 + Math.sin(a) * 14.5);
      bench.lookAt(-12, 0, 10);
      park.add(bench);
    }

    // ─── زمین فوتبال کوچک + دو دروازه ───
    const field = new THREE.Mesh(new THREE.PlaneGeometry(30, 18),
      new THREE.MeshLambertMaterial({ color: 0x23a55a }));
    field.rotation.x = -Math.PI / 2;
    field.position.set(BALL_HOME.x - PX, 0.03, BALL_HOME.z - PZ);
    park.add(field);

    // خطوط زمین
    const lineM = new THREE.MeshBasicMaterial({ color: 0xffffff });
    [[0, -8.6, 29, 0.25], [0, 8.6, 29, 0.25], [-14.4, 0, 0.25, 17], [14.4, 0, 0.25, 17], [0, 0, 0.25, 0.01]].forEach(([lx, lz, lw, lh]) => {
      const ln = new THREE.Mesh(new THREE.PlaneGeometry(lw, lh || 17), lineM);
      ln.rotation.x = -Math.PI / 2;
      ln.position.set(lx, 0.05, lz);
      park.add(ln);
    });
    const centerCirc = new THREE.Mesh(new THREE.RingGeometry(2.4, 2.65, 20), lineM);
    centerCirc.rotation.x = -Math.PI / 2;
    centerCirc.position.set(0, 0.05, 0);
    park.add(centerCirc);

    // دروازه‌ها
    [[-14.4], [14.4]].forEach(([gx]) => {
      const goal = new THREE.Group();
      const postM = new THREE.MeshPhongMaterial({ color: 0xffffff });
      [-3.4, 3.4].forEach(py => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.3, 8), postM);
        post.position.set(0, 1.15, py);
        post.castShadow = true;
        goal.add(post);
      });
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6.8, 8), postM);
      bar.rotation.x = Math.PI / 2;
      bar.position.set(0, 2.3, 0);
      goal.add(bar);
      const net = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 2.2),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
      net.position.set(gx > 0 ? -0.9 : 0.9, 1.1, 0);
      net.rotation.y = Math.PI / 2;
      goal.add(net);
      goal.position.set(gx, 0, 0);
      park.add(goal);
    });

    // نیمکت ذخیره کنار زمین
    const dugout = new THREE.Mesh(new THREE.BoxGeometry(6, 1.6, 1.2),
      new THREE.MeshPhongMaterial({ color: 0x334155 }));
    dugout.position.set(-4, 0.8, 11.5);
    dugout.castShadow = true;
    park.add(dugout);

    // پرچم‌های رنگی دور زمین
    for (let i = 0; i < 4; i++) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6),
        new THREE.MeshLambertMaterial({ color: 0xdddddd }));
      const fxp = [-15, 15][i % 2];
      const fzp = [-9.5, 9.5][Math.floor(i / 2)];
      pole.position.set(fxp, 1.1, fzp);
      park.add(pole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.4),
        new THREE.MeshBasicMaterial({ color: [0xef4444, 0x3b82f6, 0x22c55e, 0xf59e0b][i], side: THREE.DoubleSide }));
      flag.position.set(fxp + 0.36, 1.95, fzp);
      park.add(flag);
    }

    park.position.set(PX, 0, PZ);
    scene.add(park);

    // برچسب
    const plbl = _makeTextSprite('🌳 پارک شهر', '#86efac');
    plbl.position.set(PX, 14, PZ - R);
    plbl.scale.set(6, 2, 1);
    scene.add(plbl);
    labels.push(plbl);
  }

  // ─────────────────────────────────────────────
  // مرکز پلیس — ساختمان + ماشین‌های گشتی با چراغ گردان
  // ─────────────────────────────────────────────
  function _buildPoliceStation() {
    const PX = 122, PZ = -112;
    const st = new THREE.Group();

    const wallM  = new THREE.MeshPhongMaterial({ color: 0xe2e8f0, shininess: 30 });
    const blueM  = new THREE.MeshPhongMaterial({ color: 0x1d4ed8, shininess: 60 });
    const glassM = new THREE.MeshPhongMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.55, shininess: 130 });

    // بدنه اصلی
    const main = new THREE.Mesh(new THREE.BoxGeometry(20, 9, 13), wallM);
    main.position.y = 4.5;
    main.castShadow = true;
    main.receiveShadow = true;
    st.add(main);

    // نوار آبی دور ساختمان
    const band = new THREE.Mesh(new THREE.BoxGeometry(20.2, 1.1, 13.2), blueM);
    band.position.y = 6.8;
    st.add(band);

    // طبقه دوم عقب‌نشسته
    const top = new THREE.Mesh(new THREE.BoxGeometry(14, 3.2, 9), wallM);
    top.position.set(0, 10.4, -1);
    top.castShadow = true;
    st.add(top);
    const topBand = new THREE.Mesh(new THREE.BoxGeometry(14.2, 0.7, 9.2), blueM);
    topBand.position.set(0, 9.2, -1);
    st.add(topBand);

    // ورودی با ستون‌ها و پله
    [-2.6, 2.6].forEach(x => {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 5.4, 12), wallM);
      col.position.set(x, 2.7, 7.1);
      col.castShadow = true;
      st.add(col);
    });
    const porch = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 2.6), blueM);
    porch.position.set(0, 5.6, 7.2);
    porch.castShadow = true;
    st.add(porch);
    [[7.9, 4.6], [7.5, 4.75]].length; // (بدون اثر)
    for (let s = 0; s < 3; s++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.22, 0.8), wallM);
      step.position.set(0, 0.11 + s * 0.22, 8.1 + s * 0.75);
      st.add(step);
    }
    const doorG = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.4, 0.14), glassM);
    doorG.position.set(0, 1.85, 6.62);
    st.add(doorG);

    // پنجره‌ها
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 5; c++) {
        if (r === 0 && c === 2) continue; // جای در
        const win = new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 0.1), glassM);
        win.position.set(-8 + c * 4, r === 0 ? 3.6 : 10.4, r === 0 ? 6.56 : 3.56);
        st.add(win);
      }
    }

    // دکل پرچم با پرچم آبی
    const fpole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 12, 8), steelGray());
    fpole.position.set(9, 6, 5);
    fpole.castShadow = true;
    st.add(fpole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4),
      new THREE.MeshPhongMaterial({ color: 0x2563eb, side: THREE.DoubleSide }));
    flag.position.set(10.2, 10.8, 5);
    flag.name = 'policeFlag';
    _policeFlagRef = flag;
    st.add(flag);

    function steelGray() { return new THREE.MeshPhongMaterial({ color: 0x94a3b8, shininess: 100 }); }

    // ماشین‌های گشتی با چراغ گردان
    st.userData.lightBars = [];
    [[-6.5, 12.5, 0], [6.5, 12.5, 0]].forEach(([cx, cz]) => {
      const car = new THREE.Group();
      const whiteM = new THREE.MeshPhongMaterial({ color: 0xf8fafc, shininess: 110 });
      const blackM = new THREE.MeshPhongMaterial({ color: 0x111827 });

      const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.55, 4.6), whiteM);
      body.position.y = 0.62;
      body.castShadow = true;
      car.add(body);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 2.4), blackM);
      cabin.position.set(0, 1.15, -0.2);
      car.add(cabin);
      // درها سفید-مشکی
      [-1, 1].forEach(s => {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 1.7), whiteM);
        panel.position.set(s * 1.07, 0.68, 0);
        car.add(panel);
      });
      // چراغ گردان
      const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.3), blackM);
      barBase.position.set(0, 1.5, -0.2);
      car.add(barBase);
      const redL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.26),
        new THREE.MeshPhongMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1 }));
      redL.position.set(-0.27, 1.62, -0.2);
      car.add(redL);
      const bluL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.26),
        new THREE.MeshPhongMaterial({ color: 0x0044ff, emissive: 0x0044ff, emissiveIntensity: 1 }));
      bluL.position.set(0.27, 1.62, -0.2);
      car.add(bluL);
      st.userData.lightBars.push({ redL, bluL });

      // چرخ‌ها
      [[1.02, 1.5], [-1.02, 1.5], [1.02, -1.5], [-1.02, -1.5]].forEach(([wx, wz]) => {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 12), blackM);
        w.rotation.z = Math.PI / 2;
        w.position.set(wx, 0.36, wz);
        car.add(w);
      });

      car.position.set(cx, 0, cz);
      car.rotation.y = Math.PI;
      st.add(car);
      _addCollider(PX + cx, PZ + cz, 1.6, 2.8);
    });

    st.position.set(PX, 0, PZ);
    scene.add(st);
    policeStations.push(st.userData);

    _addCollider(PX, PZ, 10.2, 6.8);
    _addCollider(PX, PZ - 1, 7.2, 4.8, false, 10.4); // طبقه دوم فقط ارتفاعی — بی‌اثر برای برخورد ۲بعدی

    const lbl = _makeTextSprite('🚓 مرکز پلیس', '#93c5fd');
    lbl.position.set(PX, 15.5, PZ);
    lbl.scale.set(6, 2, 1);
    scene.add(lbl);
    labels.push(lbl);
  }

  // ─────────────────────────────────────────────
  // برج‌های اداری بلند — اسکای‌لاین شرق شهر
  // ─────────────────────────────────────────────
  function _buildSkyscrapers() {
    const group = new THREE.Group();
    let winTex = null;
    try {
      const cv = document.createElement('canvas');
      cv.width = 64; cv.height = 128;
      const cx2 = cv.getContext('2d');
      cx2.fillStyle = '#0f172a';
      cx2.fillRect(0, 0, 64, 128);
      for (let y = 4; y < 124; y += 10) {
        for (let x = 4; x < 60; x += 10) {
          cx2.fillStyle = Math.random() > 0.25 ? '#ffd97a' : '#334155';
          cx2.fillRect(x, y, 6, 6);
        }
      }
      winTex = new THREE.CanvasTexture(cv);
      winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
    } catch (err) {}

    const towers = [
      { x: 70,  z: 150, w: 14, d: 14, h: 46 },
      { x: 96,  z: 158, w: 12, d: 12, h: 38 },
      { x: 118, z: 146, w: 15, d: 13, h: 54 },
      { x: 58,  z: 168, w: 11, d: 11, h: 30 },
      { x: 88,  z: 132, w: 13, d: 11, h: 34 },
      { x: 132, z: 165, w: 12, d: 12, h: 42 },
      // اداری متوسط غرب پارک
      { x: -170, z: -60, w: 12, d: 12, h: 20 },
      { x: -172, z: -88, w: 11, d: 14, h: 16 },
    ];

    towers.forEach((t, i) => {
      const tw = new THREE.Group();
      const bodyM = new THREE.MeshPhongMaterial({
        color: [0xcbd5e1, 0xb7c3d4, 0xd7dde6, 0xaebccb][i % 4],
        shininess: 80,
      });
      const glassTower = new THREE.MeshPhongMaterial({
        color: 0x7ea6cc, shininess: 150,
        map: winTex || null, emissiveMap: winTex || null,
        emissive: 0xffe9a8, emissiveIntensity: 0.55,
      });
      if (winTex && t.w >= 12) glassTower.map.repeat.set(Math.round(t.w / 4), Math.round(t.h / 4));

      // بدنه اصلی
      const body = new THREE.Mesh(new THREE.BoxGeometry(t.w, t.h, t.d),
        winTex ? glassTower : bodyM);
      body.position.y = t.h / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      tw.add(body);

      // بخش بالایی عقب‌نشسته
      const crown = new THREE.Mesh(new THREE.BoxGeometry(t.w * 0.72, t.h * 0.12, t.d * 0.72), bodyM);
      crown.position.y = t.h + t.h * 0.06;
      crown.castShadow = true;
      tw.add(crown);

      // آنتن + چراغ چشمک‌زن بلندترین‌ها
      if (t.h > 40) {
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 8, 6), steelMat());
        ant.position.y = t.h + t.h * 0.12 + 4;
        tw.add(ant);
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xff3333 }));
        beacon.position.y = ant.position.y + 4.2;
        beacon.name = 'beacon';
        tw.add(beacon);
        group.userData.beacons = group.userData.beacons || [];
        group.userData.beacons.push(beacon);
      }

      // ورودی شیشه‌ای بزرگ
      const ent = new THREE.Mesh(new THREE.BoxGeometry(t.w * 0.4, 3.2, 0.3),
        new THREE.MeshPhongMaterial({ color: 0x1e3a5f, transparent: true, opacity: 0.8, shininess: 160 }));
      ent.position.set(0, 1.6, t.d / 2 + 0.1);
      tw.add(ent);
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(t.w * 0.5, 0.2, 2.2), steelMat());
      canopy.position.set(0, 3.5, t.d / 2 + 1.1);
      tw.add(canopy);

      tw.position.set(t.x, 0, t.z);
      group.add(tw);
      _addCollider(t.x, t.z, t.w / 2 + 0.5, t.d / 2 + 0.5);
    });

    function steelMat() { return new THREE.MeshPhongMaterial({ color: 0x94a3b8, shininess: 110 }); }

    scene.add(group);
    _skyscraperBeacons = group.userData.beacons || [];

    const lbl = _makeTextSprite('🏢 برج‌های اداری', '#cbd5e1');
    lbl.position.set(95, 66, 150);
    lbl.scale.set(7, 2.2, 1);
    scene.add(lbl);
    labels.push(lbl);
  }

  // ─────────────────────────────────────────────
  // سگ همراه — دنبال کردن، نشستن، تکان دم کنار NPC
  // ─────────────────────────────────────────────
  function _buildDog() {
    dog = new THREE.Group();

    const furM  = new THREE.MeshPhongMaterial({ color: 0xb07a45, shininess: 25 });
    const furDk = new THREE.MeshPhongMaterial({ color: 0x8a5c30 });
    const darkM = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), furM);
    body.scale.set(0.85, 0.8, 1.55);
    body.position.y = 0.62;
    body.castShadow = true;
    dog.add(body);

    const headG = new THREE.Group();
    headG.position.set(0, 0.95, 0.62);
    headG.name = 'dogHead';
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), furM);
    skull.castShadow = true;
    headG.add(skull);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.26), furDk);
    snout.position.set(0, -0.05, 0.28);
    headG.add(snout);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), darkM);
    nose.position.set(0, -0.02, 0.42);
    headG.add(nose);
    [-1, 1].forEach(s => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 6), furDk);
      ear.position.set(s * 0.16, 0.26, -0.02);
      ear.rotation.z = s * -0.35;
      headG.add(ear);
    });
    [-0.11, 0.11].forEach(ex => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), darkM);
      eye.position.set(ex, 0.08, 0.24);
      headG.add(eye);
    });
    dog.add(headG);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 8, 16),
      new THREE.MeshPhongMaterial({ color: 0xdc2626 }));
    collar.position.set(0, 0.82, 0.48);
    collar.rotation.x = Math.PI / 2;
    dog.add(collar);

    const tailBase = new THREE.Group();
    tailBase.name = 'tailA';
    tailBase.position.set(0, 0.78, -0.72);
    const t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.4, 6), furM);
    t1.rotation.x = Math.PI / 2.6;
    t1.position.z = -0.18;
    tailBase.add(t1);
    const tailB = new THREE.Group();
    tailB.name = 'tailB';
    tailB.position.z = -0.38;
    const t2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.35, 6), furDk);
    t2.rotation.x = Math.PI / 2.8;
    t2.position.z = -0.15;
    tailB.add(t2);
    tailBase.add(tailB);
    dog.add(tailBase);

    const legs = [];
    [[-0.22, 0.42], [0.22, 0.42], [-0.22, -0.45], [0.22, -0.45]].forEach(([lx, lz], i) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.42, 6),
        i < 2 ? furM : furDk);
      leg.position.set(lx, 0.21, lz);
      leg.castShadow = true;
      dog.add(leg);
      legs.push(leg);
    });
    dog.userData.legs = legs;

    dog.position.set(3, 0, -7);
    scene.add(dog);
  }

  function _updateDog(delta) {
    if (!dog || !character) return;
    const now = performance.now() * 0.001;

    const dxp = character.position.x - dog.position.x;
    const dzp = character.position.z - dog.position.z;
    const distP = Math.sqrt(dxp * dxp + dzp * dzp);

    let nearNPCd = Infinity;
    for (const n of npcs) {
      if (!n.visible) continue;
      const d = Math.sqrt((n.position.x - dog.position.x) ** 2 + (n.position.z - dog.position.z) ** 2);
      if (d < nearNPCd) nearNPCd = d;
    }

    if (dogSit) {
      dog.rotation.x += (-0.45 - dog.rotation.x) * Math.min(1, delta * 5);
      dog.userData.legs.forEach((l, i) => { l.rotation.x = i < 2 ? -1.1 : 0; });
    } else {
      dog.rotation.x *= (1 - Math.min(1, delta * 5));

      if (distP > 3.2) {
        const runSpeed = Math.min(11, distP * 2.2);
        const nx = dxp / distP, nz = dzp / distP;
        dog.position.x += nx * runSpeed * delta;
        dog.position.z += nz * runSpeed * delta;
        const ty = Math.atan2(dxp, dzp);
        let dy = ty - dog.rotation.y;
        while (dy >  Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        dog.rotation.y += dy * Math.min(1, delta * 9);

        const ph = now * 13;
        dog.userData.legs.forEach((l, i) => {
          l.rotation.x = Math.sin(ph + (i % 2) * Math.PI + Math.floor(i / 2) * Math.PI) * 0.7;
        });
        dog.position.y = Math.abs(Math.sin(now * 9)) * 0.12;
      } else {
        dog.userData.legs.forEach(l => { l.rotation.x *= (1 - Math.min(1, delta * 6)); });
        dog.position.y = 0;
        const ty = Math.atan2(dxp, dzp);
        let dy = ty - dog.rotation.y;
        while (dy >  Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        dog.rotation.y += dy * Math.min(1, delta * 3);
      }
    }

    // تکان دم — کنار NPC شدیدتر!
    const wagRate = nearNPCd < 5 ? 16 : 7;
    const wagAmp = dogSit ? 0.5 : (nearNPCd < 5 ? 0.85 : 0.4);
    const tailA = dog.getObjectByName('tailA');
    const tailB = dog.getObjectByName('tailB');
    if (tailA) tailA.rotation.y = Math.sin(now * wagRate) * wagAmp;
    if (tailB) tailB.rotation.y = Math.sin(now * wagRate + 0.6) * wagAmp * 1.3;

    const dh = dog.getObjectByName('dogHead');
    if (dh && !dogSit) dh.rotation.x = Math.sin(now * 2.2) * 0.12;

    dog.position.x = Math.max(-WORLD_EDGE + 5, Math.min(WORLD_EDGE - 5, dog.position.x));
    dog.position.z = Math.max(-WORLD_EDGE + 5, Math.min(WORLD_EDGE - 5, dog.position.z));
  }

  // ─────────────────────────────────────────────
  // فیزیک اشیا — توپ فوتبال، بشکه‌ها، فواره کلیکی
  // ─────────────────────────────────────────────
  function _buildPhysicsProps() {
    football = new THREE.Group();
    const ballMat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 60 });
    football.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 14), ballMat));
    const patchM = new THREE.MeshPhongMaterial({ color: 0x111111 });
    for (let i = 0; i < 6; i++) {
      const patch = new THREE.Mesh(new THREE.CircleGeometry(0.19, 6), patchM);
      const a = (i / 6) * Math.PI;
      patch.position.set(Math.cos(a) * 0.49, Math.sin(a) * 0.49, i % 2 ? 0.3 : -0.3);
      patch.lookAt(0, 0, 0);
      patch.translateZ(0.005);
      football.add(patch);
    }
    football.position.set(BALL_HOME.x, 0.5, BALL_HOME.z);
    football.castShadow = true;
    football.userData = { vel: new THREE.Vector3(), scored: false };
    scene.add(football);

    const barrelSpots = [
      [112, -98], [114.5, -97], [113, -100.5],
      [60, 128], [63, 129.5],
    ];
    barrelSpots.forEach(([bx, bz]) => {
      const b = new THREE.Group();
      const metal = new THREE.MeshPhongMaterial({
        color: [0x8a5a2b, 0x3f6f6f, 0x6b7280][barrels.length % 3], shininess: 40
      });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.15, 14), metal);
      body.position.y = 0.575;
      body.castShadow = true;
      b.add(body);
      [0.25, 0.9].forEach(ry => {
        const rib = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.03, 6, 18),
          new THREE.MeshPhongMaterial({ color: 0x333333 }));
        rib.rotation.x = Math.PI / 2;
        rib.position.y = ry;
        b.add(rib);
      });
      b.position.set(bx, 0, bz);
      b.userData = { vel: new THREE.Vector3(), r: 0.62 };
      scene.add(b);
      barrels.push(b);
    });
  }

  function _updatePhysics(delta) {
    // ─── توپ فوتبال ───
    if (football) {
      const v = football.userData.vel;

      // شوت با تماس بدنی موقع حرکت
      if (character) {
        const dx = football.position.x - character.position.x;
        const dz = football.position.z - character.position.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        const moving = keys.w || keys.a || keys.s || keys.d ||
                       keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight;
        if (d < 1.15 && d > 0.01 && moving && v.length() < 2) {
          const p = keys.Shift ? 16 : 9;
          v.x += (dx / d) * p;
          v.z += (dz / d) * p;
          v.y += 2.5;
        }
      }

      v.y -= 22 * delta;
      football.position.x += v.x * delta;
      football.position.y += v.y * delta;
      football.position.z += v.z * delta;

      const groundY = 0.5;
      if (football.position.y <= groundY) {
        football.position.y = groundY;
        if (v.y < -1) v.y = -v.y * 0.52; else v.y = 0;
        const fr = Math.pow(0.32, delta);
        v.x *= fr; v.z *= fr;
        if (v.length() < 0.15) v.set(0, 0, 0);
      }

      if (_collides(football.position.x, football.position.z)) {
        v.x *= -0.55; v.z *= -0.55;
        football.position.x -= v.x * delta * 2;
        football.position.z -= v.z * delta * 2;
      }
      if (Math.abs(football.position.x) > WORLD_EDGE - 3) {
        v.x *= -0.5;
        football.position.x = Math.sign(football.position.x) * (WORLD_EDGE - 3);
      }
      if (Math.abs(football.position.z) > WORLD_EDGE - 3) {
        v.z *= -0.5;
        football.position.z = Math.sign(football.position.z) * (WORLD_EDGE - 3);
      }

      // گل در دروازه‌های پارک
      const relX = football.position.x - BALL_HOME.x;
      const relZ = football.position.z - BALL_HOME.z;
      if (!football.userData.scored &&
          ((Math.abs(relX + 14.4) < 0.7 && Math.abs(relZ) < 3.2) ||
           (Math.abs(relX - 14.4) < 0.7 && Math.abs(relZ) < 3.2)) &&
          football.position.y < 2.2) {
        football.userData.scored = true;
        _showToast('🥅 گللل! چه ضربه‌ای!');
        _spawnSmoke(new THREE.Vector3(relX + BALL_HOME.x, 1.5, relZ + BALL_HOME.z));
        setTimeout(() => {
          if (!football) return;
          football.position.set(BALL_HOME.x, 0.5, BALL_HOME.z);
          football.userData.vel.set(0, 0, 0);
          football.userData.scored = false;
        }, 1400);
      }

      const sp = Math.sqrt(v.x * v.x + v.z * v.z);
      if (sp > 0.05) {
        football.rotateOnWorldAxis(
          new THREE.Vector3(v.z / sp, 0, -v.x / sp).normalize(),
          (sp / 0.5) * delta
        );
      }
    }

    // ─── بشکه‌های قابل هل دادن ───
    for (const b of barrels) {
      const u = b.userData.vel;
      if (character) {
        const dx = b.position.x - character.position.x;
        const dz = b.position.z - character.position.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        const minD = u.r + 0.55;
        if (d < minD && d > 0.01) {
          const push = (minD - d) * 300;
          u.x += (dx / d) * push * delta;
          u.z += (dz / d) * push * delta;
          b.position.x += (dx / d) * (minD - d);
          b.position.z += (dz / d) * (minD - d);
        }
      }
      for (const o of barrels) {
        if (o === b) continue;
        const dx = b.position.x - o.position.x;
        const dz = b.position.z - o.position.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        const minD = u.r * 2;
        if (d < minD && d > 0.01) {
          const f = (minD - d) / 2;
          b.position.x += (dx / d) * f;
          b.position.z += (dz / d) * f;
          o.position.x -= (dx / d) * f;
          o.position.z -= (dz / d) * f;
          u.multiplyScalar(0.7);
        }
      }

      b.position.x += u.x * delta;
      b.position.z += u.z * delta;
      const fr = Math.pow(0.05, delta);
      u.x *= fr; u.z *= fr;

      const sp = Math.sqrt(u.x * u.x + u.z * u.z);
      if (sp > 0.1) {
        b.rotateOnWorldAxis(new THREE.Vector3(u.z / sp, 0, -u.x / sp).normalize(), (sp / 0.55) * delta);
      }
      if (_collides(b.position.x, b.position.z)) {
        b.position.x -= u.x * delta * 2;
        b.position.z -= u.z * delta * 2;
        u.multiplyScalar(-0.4);
      }
      b.position.x = Math.max(-WORLD_EDGE + 4, Math.min(WORLD_EDGE - 4, b.position.x));
      b.position.z = Math.max(-WORLD_EDGE + 4, Math.min(WORLD_EDGE - 4, b.position.z));
    }

    // ─── فواره کلیکی ───
    if (fountainRef) {
      const jet = fountainRef.getObjectByName('jet');
      const water = fountainRef.getObjectByName('water');
      if (jet) jet.visible = fountainOn;
      if (water) water.material.opacity = fountainOn ? 0.75 : 0.4;
    }
  }

  function _updateMinimap() {
    const canvas = document.getElementById('city-minimap-canvas');
    if (!canvas || typeof canvas.getContext !== 'function') return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2;
    const S = MINIMAP_SCALE * (W / 2);

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, W, H);

    // ساختمان‌ها
    buildings.forEach(b => {
      const bx = cx + b.config.position.x * S;
      const by = cy + b.config.position.z * S;
      ctx.fillStyle = b.accessible ? '#' + b.config.color.toString(16).padStart(6,'0') : '#4b5563';
      ctx.fillRect(bx - 5, by - 5, 10, 10);
      ctx.fillStyle = '#fff';
      ctx.font = '7px Tahoma';
      ctx.textAlign = 'center';
      ctx.fillText(b.config.icon, bx, by - 7);
    });

    // ماشین روی minimap (مربع قرمز)
    if (carMesh) {
      const mx = cx + carMesh.position.x * S;
      const my = cy + carMesh.position.z * S;
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(-carMesh.rotation.y);
      ctx.fillStyle = inCar ? '#f87171' : '#fca5a5';
      ctx.fillRect(-5, -8, 10, 16);    // بدنه ماشین
      ctx.fillStyle = '#fde047';
      ctx.fillRect(-4, 5, 8, 3);       // چراغ عقب
      ctx.restore();
      // آیکون
      ctx.fillStyle = '#fff';
      ctx.font = '9px Tahoma';
      ctx.textAlign = 'center';
      ctx.fillText('🚗', mx, my - 11);
    }

    // کاراکتر (پیاده) یا موقعیت داخل وسیله
    if (!inCar && !inTank) {
      const px = cx + character.position.x * S;
      const py = cy + character.position.z * S;
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-character.rotation.y);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(0, -8); ctx.lineTo(-3, 0); ctx.lineTo(3, 0);
      ctx.fill();
      ctx.restore();
    } else if (inCar && carMesh) {
      // نشانگر "شما" روی ماشین
      const px = cx + carMesh.position.x * S;
      const py = cy + carMesh.position.z * S;
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 9px Tahoma';
      ctx.textAlign = 'center';
      ctx.fillText('YOU', px, py + 4);
    } else if (inTank && tank) {
      // نشانگر "شما" روی تانک
      const px = cx + tank.position.x * S;
      const py = cy + tank.position.z * S;
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 9px Tahoma';
      ctx.textAlign = 'center';
      ctx.fillText('YOU', px, py + 4);
    }

    // تانک روی minimap
    if (tank) {
      const tx = cx + tank.position.x * S;
      const ty = cy + tank.position.z * S;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(-tank.rotation.y);
      ctx.fillStyle = inTank ? '#4ade80' : '#86efac';
      ctx.fillRect(-6, -9, 12, 18);
      ctx.fillStyle = '#166534';
      ctx.fillRect(-2, -14, 4, 8); // لوله توپ
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.font = '9px Tahoma';
      ctx.textAlign = 'center';
      ctx.fillText('🪖', tx, ty - 13);
    }

    // جنگنده روی minimap
    if (fighterJet) {
      const jx = cx + fighterJet.position.x * S;
      const jy = cy + fighterJet.position.z * S;
      ctx.save();
      ctx.translate(jx, jy);
      ctx.rotate(-fighterJet.rotation.y + Math.PI / 2);
      ctx.fillStyle = inJet ? '#38bdf8' : '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(0, -8); ctx.lineTo(-4, 6); ctx.lineTo(0, 3); ctx.lineTo(4, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // ─── لندمارک‌ها ───
    // پارک بزرگ (مربع سبز)
    const pkx = cx + (-125) * S, pkz = cy + (-118) * S;
    ctx.fillStyle = 'rgba(34,197,94,0.55)';
    ctx.fillRect(pkx - 40 * S / 2 - 20, pkz - 20, 40 * S + 40, 40);
    // مرکز پلیس
    const pcx = cx + 122 * S, pcz = cy + (-112) * S;
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(pcx - 4, pcz - 4, 8, 8);
    ctx.fillStyle = '#fff'; ctx.font = '7px Tahoma'; ctx.textAlign = 'center';
    ctx.fillText('🚓', pcx, pcz - 6);
    // برج‌ها
    ctx.fillStyle = '#94a3b8';
    [[70,150],[96,158],[118,146],[88,132],[132,165]].forEach(([tx2,tz2]) => {
      ctx.fillRect(cx + tx2 * S - 2.5, cy + tz2 * S - 2.5, 5, 5);
    });

    // توپ فوتبال
    if (football) {
      const bxx = cx + football.position.x * S;
      const bzz = cy + football.position.z * S;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(bxx, bzz, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.stroke();
    }

    // سگ همراه 🐶
    if (dog) {
      const dxx = cx + dog.position.x * S;
      const dzz = cy + dog.position.z * S;
      ctx.fillStyle = '#b07a45';
      ctx.beginPath(); ctx.arc(dxx, dzz, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '7px Tahoma'; ctx.textAlign = 'center';
      ctx.fillText('🐶', dxx, dzz - 5);
    }

    // هلی‌کوپتر روی minimap
    if (helicopter) {
      const hx = cx + helicopter.position.x * S;
      const hy = cy + helicopter.position.z * S;
      ctx.fillStyle = '#60a5fa';
      ctx.beginPath();
      ctx.arc(hx, hy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '8px Tahoma';
      ctx.textAlign = 'center';
      ctx.fillText('🚁', hx, hy - 7);
    }

    // NPC ها روی minimap — نقطه‌های رنگی
    npcs.forEach((npc, i) => {
      if (!npc.visible) return;
      const nx = cx + npc.position.x * S;
      const ny = cy + npc.position.z * S;
      const cfg = NPC_CONFIGS[i];
      ctx.fillStyle = '#' + (cfg ? cfg.color.toString(16).padStart(6,'0') : 'aaaaaa');
      ctx.beginPath();
      ctx.arc(nx, ny, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // border
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, W, H);
  }

  // ─────────────────────────────────────────────
  // ساخت NPC — کاربران واقعی سیستم
  // ─────────────────────────────────────────────
  function _buildNPCs() {
    npcs = [];

    NPC_CONFIGS.forEach((cfg, idx) => {
      // seed ثابت هر شخصیت — چهره و اندام پایدار و متمایز (نه هر بار تازه)
      const S = (idx * 37 + 11) >>> 0;
      const npc = _makeCharacterMesh(cfg.color, {
        name: cfg.name,
        agent: cfg.role === 'agent',
        gender: cfg.gender,
        seed: S,
      });
      // تنوع قد و اندام — ثابت برای هر شخصیت
      npc.scale.setScalar(0.92 + ((S % 19) * 0.006));

      // ادغام با داده‌های اسکلت سازنده (limbs/joints) — بازنویسی نشود!
      Object.assign(npc.userData, {
        name: cfg.name,
        role: cfg.role,
        speed: cfg.speed,
        gait: cfg.gait,
        energy: cfg.energy,
        perk: cfg.perk,
        stance: cfg.stance,
        state: 'walk',       // walk | enter | inside | exit | talking | paused
        target: null,        // ساختمان مقصد
        insideTimer: 0,
        waitTimer: 0,
        angle: (idx / NPC_CONFIGS.length) * Math.PI * 2,
        phase: Math.random() * Math.PI * 2, // فاز گام هر NPC
        blinkT: 1 + Math.random() * 3,
        blinkPhase: 0,
        lastLineIdx: -1,
        ambT: 2 + Math.random() * 3,
        // ─── رفتار طبیعی ───
        cur: cfg.speed,                        // سرعت فعلی (نرم تغییر می‌کنه)
        baseSpeed: cfg.speed,
        idmT: 2 + Math.random() * 5,           // تا ژست بعدی (سکون)
        pauseT: 3 + Math.random() * 4,         // تا توقف برای یک نگاه
        bx: 0,                                 // وزن آونگ بدن هنگام ایستادن
        lookT: 0,
        // مسیر NPC
        path: [],
        pathIdx: 0,
      });

      // موقعیت تصادفی اولیه — پراکنده در شهر بزرگ
      const angle = (idx / NPC_CONFIGS.length) * Math.PI * 2;
      npc.position.set(
        Math.cos(angle) * (25 + idx * 8),
        0,
        Math.sin(angle) * (25 + idx * 8)
      );

      // برچسب نام
      const label = _makeTextSprite(cfg.name + '\n' + (cfg.role === 'agent' ? '🔧 عامل' : '👤 کارمند'),
        cfg.role === 'agent' ? '#60a5fa' : '#a3e635');
      label.position.set(0, 2.6, 0);
      label.scale.set(3, 1.2, 1);
      npc.add(label);

      scene.add(npc);
      npcs.push(npc);
    });

    // ─── هوک اختیاری: مدل واقعی Mixamo (.glb ریک‌شده) ───
    // اگر NPC_MODEL_URL تنظیم شده باشد و SkeletonUtils موجود باشد،
    // کاراکتر GLB جایگزین بدنه رویه‌ای می‌شود؛ لایه‌ها بدون تغییر کار می‌کنند.
    if (NPC_MODEL_URL && typeof THREE.GLTFLoader === 'function') {
      try {
        new THREE.GLTFLoader().load(NPC_MODEL_URL, _applyGltfModelToNPCs, undefined, () => {});
      } catch (err) { /* fallback رویه‌ای */ }
    }
  }

  // ─────────────────────────────────────────────
  // ترافیک شهری — ماشین‌های NPC با حلقه مسیر، ترمز و پیچ
  // ─────────────────────────────────────────────
  function mkRectLoop(x1, z1, x2, z2, inset) {
    return [
      { x: x1 + inset, z: z1 + inset },
      { x: x2 - inset, z: z1 + inset },
      { x: x2 - inset, z: z2 - inset },
      { x: x1 + inset, z: z2 - inset },
    ];
  }

  function _buildTraffic() {
    const loops = [
      mkRectLoop(-52, -52, 52, 52, 3.4),     // هسته مرکزی
      mkRectLoop(-84, 55, 84, 90, 3.4),      // نوار شمالی
      mkRectLoop(-84, -90, 84, -55, 3.4),    // نوار جنوبی
      mkRectLoop(52, -138, 138, -58, 3.4),   // شرق دور
    ];
    const colors = [0x2563eb, 0x059669, 0xd97706, 0x7c3aed, 0xdc2626, 0x0891b2, 0xdb2777, 0x65a30d];
    let ci = 0;

    loops.forEach((pts, li) => {
      const count = li === 0 ? 3 : 2;
      for (let i = 0; i < count; i++) {
        const car = _makeTrafficCar(colors[ci++ % colors.length]);
        const startPt = pts[(i * 2) % pts.length];
        car.position.set(startPt.x, 0, startPt.z);
        car.userData = {
          path: pts,
          idx: 1,
          speed: 8 + Math.random() * 3.5,
          cur: 0, // سرعت فعلی برای ترمز
          yaw: Math.atan2(
            pts[1].x - pts[0].x, pts[1].z - pts[0].z
          ),
        };
        car.rotation.y = car.userData.yaw;
        scene.add(car);
        trafficCars.push(car);
      }
    });
  }

  function _makeTrafficCar(color) {
    const g = new THREE.Group();
    const paint = new THREE.MeshPhongMaterial({ color, shininess: 100 });
    const darkM = new THREE.MeshPhongMaterial({ color: 0x111827 });
    const glass = new THREE.MeshPhongMaterial({ color: 0xa8cdf0, transparent: true, opacity: 0.5, shininess: 140 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.6, 4.3), paint);
    body.position.y = 0.62;
    body.castShadow = true;
    g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.55, 2.1), paint);
    cabin.position.set(0, 1.18, -0.15);
    cabin.castShadow = true;
    g.add(cabin);
    const ws = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.5, 0.06), glass);
    ws.position.set(0, 1.16, 0.92);
    ws.rotation.x = 0.4;
    g.add(ws);

    // چراغ‌ها
    const headM = new THREE.MeshBasicMaterial({ color: 0xfff3c4 });
    [-0.62, 0.62].forEach(x => {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.05), headM);
      h.position.set(x, 0.72, 2.17);
      g.add(h);
    });
    const tailM = new THREE.MeshBasicMaterial({ color: 0xff4444 });
    [-0.62, 0.62].forEach(x => {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.05), tailM);
      t.position.set(x, 0.74, -2.17);
      g.add(t);
    });

    [[0.95, 1.42], [-0.95, 1.42], [0.95, -1.42], [-0.95, -1.42]].forEach(([wx, wz]) => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 10), darkM);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.34, wz);
      w.castShadow = true;
      g.add(w);
    });

    return g;
  }

  function _updateTraffic(delta) {
    for (const car of trafficCars) {
      const ud = car.userData;
      const target = ud.path[ud.idx];
      const dx = target.x - car.position.x;
      const dz = target.z - car.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 5) {
        ud.idx = (ud.idx + 1) % ud.path.length;
        continue;
      }

      // پیچ نرم به سمت وِی‌پوینت
      const desiredYaw = Math.atan2(dx, dz);
      let diff = desiredYaw - ud.yaw;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ud.yaw += Math.max(-2.2 * delta, Math.min(2.2 * delta, diff));
      const turning = Math.abs(diff) > 0.45;

      // ─── ترمز پشت موانع: ماشین دیگر / بازیکن / سگ ───
      let blocked = false;
      const fx = Math.sin(ud.yaw), fz = Math.cos(ud.yaw);
      const checkAhead = (ox, oz, range) => {
        const ax = ox - car.position.x;
        const az = oz - car.position.z;
        const d = Math.sqrt(ax * ax + az * az);
        if (d > range) return false;
        const dot = (ax / d) * fx + (az / d) * fz;
        return dot > 0.75; // جلوی ماشین
      };
      for (const other of trafficCars) {
        if (other === car) continue;
        if (checkAhead(other.position.x, other.position.z, 8)) { blocked = true; break; }
      }
      if (!blocked && character && checkAhead(character.position.x, character.position.z, 6)) blocked = true;
      if (!blocked && dog && checkAhead(dog.position.x, dog.position.z, 5)) blocked = true;

      const cruise = turning ? ud.speed * 0.45 : ud.speed;
      ud.cur += ((blocked ? 0 : cruise) - ud.cur) * Math.min(1, delta * (blocked ? 6 : 2));

      if (ud.cur > 0.02) {
        car.position.x += Math.sin(ud.yaw) * ud.cur * delta;
        car.position.z += Math.cos(ud.yaw) * ud.cur * delta;
        car.rotation.y = ud.yaw;
        // کج شدن ملایم در پیچ
        car.rotation.z += ((-Math.sin(diff)) * 0.06 - car.rotation.z) * Math.min(1, delta * 3);
      }
    }
  }

  // ─────────────────────────────────────────────
  // عابرهای پیاده — تردد روی خط عابر
  // ─────────────────────────────────────────────
  function _buildPedestrians() {
    const routes = [
      // عبور از زیبرای افقی مرکزی (حرکت در محور z)
      [{ x: 2.5, z: -14 }, { x: 2.5, z: 14 }],
      [{ x: -2.5, z: 14 }, { x: -2.5, z: -14 }],
      // زیبرای شمالی
      [{ x: 8, z: 48 }, { x: 8, z: 62 }],
      [{ x: -8, z: 62 }, { x: -8, z: 48 }],
      // زیبرای جنوبی
      [{ x: 8, z: -48 }, { x: 8, z: -62 }],
      [{ x: -8, z: -62 }, { x: -8, z: -48 }],
    ];
    const names = ['عابر', 'رهگذر', 'همسایه', 'مسافر', 'دونده', 'خریدار'];

    routes.forEach((route, i) => {
      const p = _makeCharacterMesh([0xf59e0b, 0x10b981, 0x3b82f6, 0xec4899][i % 4], {});
      p.scale.setScalar(0.94 + Math.random() * 0.1);
      const a = route[0];
      p.position.set(a.x, 0, a.z);
      Object.assign(p.userData, {
        name: names[i % names.length],
        role: 'civilian',
        crosser: true,
        route,
        ri: 1,
        waitT: Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
        blinkT: 2 + Math.random() * 3,
        blinkPhase: 0,
        state: 'walk',
      });
      scene.add(p);
      pedestrians.push(p);
    });
  }

  function _updatePedestrians(delta) {
    for (const p of pedestrians) {
      const ud = p.userData;
      const tgt = ud.route[ud.ri];
      const dx = tgt.x - p.position.x;
      const dz = tgt.z - p.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 0.7) {
        // ایست در لبه پیاده‌رو — گاهی طولانی (منتظر ترافیک)
        ud.waitT -= delta;
        if (ud.waitT <= 0) {
          ud.ri = (ud.ri + 1) % ud.route.length;
          ud.waitT = 1 + Math.random() * 3.5;
        }
        _animateNPC(p, delta); // تنفس/نگاه حتی در ایستادن
        continue;
      }

      // قبل از قدم گذاشتن روی جاده، اجازه بگیر از ترافیک
      const onRoadZ = Math.abs(p.position.z) < 5 || Math.abs(p.position.z - 55) < 4 || Math.abs(p.position.z + 55) < 4;
      if (onRoadZ) {
        const danger = trafficCars.some(c =>
          Math.abs(c.position.x - p.position.x) < 5 &&
          Math.abs(c.position.z - p.position.z) < 5
        );
        if (danger) {
          _animateNPC(p, delta);
          continue;
        }
      }

      const spd = 1.9 * delta;
      p.position.x += (dx / dist) * spd;
      p.position.z += (dz / dist) * spd;
      const ty = Math.atan2(dx, dz);
      let dy = ty - p.rotation.y;
      while (dy >  Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      p.rotation.y += dy * Math.min(1, delta * 8);

      ud.phase += delta * 6.5;
      _animHumanoid(p, ud.phase, 0.45);
      _applyReactionLayer(p, delta);
      _applyTrackingLayer(p, delta);
    }
  }

  // اعمال مدل GLB ریک‌شده روی همه NPCها
  function _applyGltfModelToNPCs(gltf) {
    if (!THREE.SkeletonUtils) return; // کلون امن اسکلت بدون این ممکن نیست
    const src = gltf.scene;
    const bbox = new THREE.Box3().setFromObject(src);
    const h = Math.max(0.1, bbox.max.y - bbox.min.y);
    const s = 1.8 / h;

    npcs.forEach(npc => {
      const model = THREE.SkeletonUtils.clone(src);
      model.scale.setScalar(s);
      model.traverse(o => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      });
      npc.add(model);

      // Mixer + کلیپ‌ها — تراک‌های Neck/Spine حذف می‌شوند تا
      // لایه‌های tracking/ری‌اکشن مستقل کنترلشان کنند
      const mixer = new THREE.AnimationMixer(model);
      const actions = {};
      (gltf.animations || []).forEach(clip => {
        const filtered = clip.clone();
        filtered.tracks = filtered.tracks.filter(
          tr => !/^mixamorig(Neck|HeadTop)?\.?(Neck|Spine)/i.test(tr.name) &&
                !/(mixamorigNeck|mixamorigSpine)\./i.test(tr.name)
        );
        actions[clip.name] = mixer.clipAction(filtered);
      });
      const idleKey = Object.keys(actions).find(k => /idle/i.test(k)) || Object.keys(actions)[0];
      if (idleKey) actions[idleKey].play();

      npc.userData.gltf = { mixer, actions };

      // مفاصل واقعی اسکلت → همان رجیستری که لایه‌ها استفاده می‌کنند
      ['mixamorigNeck', 'mixamorigSpine', 'mixamorigHead',
       'mixamorigLeftArm', 'mixamorigRightArm',
       'mixamorigLeftForeArm', 'mixamorigRightForeArm'].forEach(n => {
        const bone = model.getObjectByName(n);
        if (bone) npc.userData.joints[n] = bone;
      });

      // مخفی کردن بدنه رویه‌ای (اسپرایت برچسب می‌ماند)
      npc.children.forEach(c => {
        if (c !== model && !c.isSprite) c.visible = false;
      });
    });
  }

  // ساخت انسان واقع‌گرایانه — صورت کامل، لباس با جزییات، اکسسوری تصادفی
  function _makeCharacterMesh(shirtColor, person) {
    person = person || {};
    const FEMALE = ['سارا', 'زینب'];
    const isFemale = FEMALE.includes(person.name) || person.gender === 'female';

    // ─── RNG seed ثابت برای هر شخصیت (چهره پایدار و متمایز) ───
    let _mr = (person.seed || 7) >>> 0;
    const rnd = () => {
      _mr = (_mr * 1664525 + 1013904223) >>> 0;
      return _mr / 4294967296;
    };

    const SKIN_TONES = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
    const HAIR_COLORS = [0x1b1512, 0x2b1d16, 0x4a3120, 0x111116, 0x5a4632];
    const PANT_COLORS = [0x1e293b, 0x334155, 0x3f3f46, 0x27272a];
    const HIJAB_COLORS = [0xdc2626, 0x7c3aed, 0x0891b2, 0xdb2777, 0x16a34a];
    const EYE_COLORS = [0x2b2b33, 0x4a3b1e, 0x1f3b2c, 0x3a2d1b];
    const skin = SKIN_TONES[Math.floor(rnd() * SKIN_TONES.length)];
    const hairC = HAIR_COLORS[Math.floor(rnd() * HAIR_COLORS.length)];
    const pantC = PANT_COLORS[Math.floor(rnd() * PANT_COLORS.length)];
    const eyeC = EYE_COLORS[Math.floor(rnd() * EYE_COLORS.length)];
    const shirtDark = new THREE.Color(shirtColor).multiplyScalar(0.72).getHex();

    // ─── تنوع اندام (شانه/سینه/لگن) — ثابت و توپر ───
    const broad = 0.85 + rnd() * 0.35;   // پهنای شانه/سینه
    const hipW = 0.85 + rnd() * 0.3;     // پهنای لگن
    const headW = 0.9 + rnd() * 0.18;    // پهنای سر

    const group = new THREE.Group();
    const all = [];

    // ─── لگن + کمربند ───
    const hips = new THREE.Group();
    hips.position.y = 0.92;
    group.add(hips);

    const pelvis = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.18, 0.22),
      new THREE.MeshPhongMaterial({ color: pantC })
    );
    pelvis.castShadow = true;
    hips.add(pelvis);
    pelvis.scale.set(hipW > 1 ? hipW : 1, 1, hipW);

    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.05, 0.24),
      new THREE.MeshPhongMaterial({ color: 0x292524 })
    );
    belt.position.y = 0.1;
    hips.add(belt);
    const buckle = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.04, 0.02),
      new THREE.MeshPhongMaterial({ color: 0xcaa54a, shininess: 90 })
    );
    buckle.position.set(0, 0.1, 0.125);
    hips.add(buckle);

    // ─── ستون فقرات (mixamorigSpine) — کل بالاتنه روی این پیوت ───
    const spinePivot = new THREE.Group();
    spinePivot.position.y = 0.12;
    hips.add(spinePivot);

    // تنه — کمر باریک، سینه پهن
    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.19, 0.6, 10),
      new THREE.MeshPhongMaterial({ color: shirtColor })
    );
    torso.position.y = 0.28;
    torso.castShadow = true;
    torso.name = 'torsoMesh';
    spinePivot.add(torso);

    const chest = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.24, 0.27),
      new THREE.MeshPhongMaterial({ color: shirtColor })
    );
    chest.position.y = 0.54;
    chest.castShadow = true;
    spinePivot.add(chest);
    // پهنای شانه / سینه — مرد پهن‌تر، زن باریک‌تر
    chest.scale.set(isFemale ? broad * 0.82 : broad, 1, 1 + (broad - 1) * 0.5);
    torso.scale.set(1, 1, 1 + (isFemale ? (broad - 1) * 0.4 : 0));

    // یقه
    const collarV = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.14, 4),
      new THREE.MeshPhongMaterial({ color: shirtDark })
    );
    collarV.rotation.x = Math.PI;
    collarV.rotation.y = Math.PI / 4;
    collarV.position.set(0, 0.64, 0.115);
    spinePivot.add(collarV);

    // دکمه‌ها
    for (let i = 0; i < 3; i++) {
      const btn = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 6, 6),
        new THREE.MeshPhongMaterial({ color: 0xe7e5e4 })
      );
      btn.position.set(0, 0.5 - i * 0.11, 0.132);
      spinePivot.add(btn);
    }

    // ─── گردن (mixamorigNeck) و سر (mixamorigHead) جدا برای tracking مستقل ───
    const neckMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.075, 0.12, 8),
      new THREE.MeshPhongMaterial({ color: skin })
    );
    neckMesh.position.y = 0.66;
    spinePivot.add(neckMesh);

    const neckPivot = new THREE.Group();
    neckPivot.position.y = 0.7;
    spinePivot.add(neckPivot);

    const headGrp = new THREE.Group();
    headGrp.position.y = 0.22;
    neckPivot.add(headGrp);

    const skull = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 16, 14),
      new THREE.MeshPhongMaterial({ color: skin })
    );
    skull.scale.set(0.9 * headW, 1.06 + rnd() * 0.08, 0.96 * (0.92 + rnd() * 0.14));
    skull.castShadow = true;
    headGrp.add(skull);

    // فک — برای صورت‌های مربعی‌تر
    const jawW = 0.15 + rnd() * 0.05;
    const jaw = new THREE.Mesh(
      new THREE.SphereGeometry(jawW, 12, 10),
      new THREE.MeshPhongMaterial({ color: skin })
    );
    jaw.scale.set(1.5, 0.55, 1);
    jaw.position.set(0, -0.16, 0);
    headGrp.add(jaw);

    // گوش‌ها
    [-1, 1].forEach(s => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8),
        new THREE.MeshPhongMaterial({ color: skin }));
      ear.position.set(s * 0.145, -0.005, 0);
      ear.scale.set(0.5, 1, 0.8);
      headGrp.add(ear);
    });

    // مو یا حجاب
    if (isFemale) {
      const hc = HIJAB_COLORS[Math.floor(rnd() * HIJAB_COLORS.length)];
      const hijab = new THREE.Mesh(
        new THREE.SphereGeometry(0.175, 14, 12, 0, Math.PI * 2, 0, Math.PI / 1.55),
        new THREE.MeshPhongMaterial({ color: hc })
      );
      hijab.position.y = 0.005;
      headGrp.add(hijab);
      // پارچه کنار صورت
      const drape = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.16, 0.22, 10, 1, true),
        new THREE.MeshPhongMaterial({ color: hc, side: THREE.DoubleSide })
      );
      drape.position.set(0, -0.1, -0.02);
      headGrp.add(drape);
    } else {
      const hair = new THREE.Mesh(
        new THREE.SphereGeometry(0.168, 14, 8, 0, Math.PI * 2, 0, Math.PI / 1.85),
        new THREE.MeshPhongMaterial({ color: hairC })
      );
      hair.position.y = 0.01;
      headGrp.add(hair);
      // خط ریش سبک برای بعضی‌ها
      if (rnd() < 0.4) {
        const beardW = 0.85 + rnd() * 0.2;
        const beard = new THREE.Mesh(
          new THREE.SphereGeometry(0.152, 12, 8, 0, Math.PI * 2, Math.PI / 2.4, Math.PI / 2),
          new THREE.MeshPhongMaterial({ color: hairC })
        );
        beard.scale.set(0.88 * beardW, 0.7, 0.94);
        beard.position.set(0, -0.01, 0.012);
        headGrp.add(beard);
      }
      // کلاه/کیپ برای بعضی‌ها
      if (rnd() < 0.28) {
        const capM = new THREE.MeshPhongMaterial({ color: 0x1f2937 });
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.17, 0.09, 12), capM);
        cap.position.y = 0.135;
        headGrp.add(cap);
        const brim = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.14), capM);
        brim.position.set(0, 0.1, 0.15);
        headGrp.add(brim);
      }
    }

    // ─── صورت: چشم، ابرو، بینی، دهان ───
    const eyeM = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilM = new THREE.MeshBasicMaterial({ color: eyeC });
    const eyes = [];
    const brows = [];
    const eyeSep = 0.054 + rnd() * 0.016;       // فاصله چشم‌ها — بسته به چهره
    const eyeSize = 0.023 + rnd() * 0.008;      // اندازه چشم
    const eyeY = 0.02 + rnd() * 0.012;          // ارتفاع چشم روی صورت
    const browY = 0.062 + rnd() * 0.015;         // ارتفاع ابرو
    [-1, 1].forEach(s => {
      const ex = s * eyeSep;
      const white = new THREE.Mesh(new THREE.SphereGeometry(eyeSize, 8, 8), eyeM);
      white.position.set(ex, eyeY, 0.128);
      white.scale.set(1, 0.82, 0.6);
      white.name = 'eyeWhite';
      headGrp.add(white);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(eyeSize * 0.48, 6, 6), pupilM);
      pupil.position.set(ex, eyeY, 0.148);
      pupil.name = 'pupil';
      headGrp.add(pupil);
      eyes.push(white);

      // ابرو — با قوس طبیعی و لبه‌ی مورب
      const brow = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.0085, 0.01),
        new THREE.MeshPhongMaterial({ color: hairC })
      );
      brow.position.set(ex, browY, 0.142);
      brow.rotation.z = -s * (0.05 + rnd() * 0.12);    // برخی ابروها مورب
      brow.castShadow = true;
      brow.userData.baseScale = 1;
      headGrp.add(brow);
      brows.push(brow);
    });

    // بینی — سایز متفاوت
    const noseW = 0.02 + rnd() * 0.008;
    const noseLen = 0.05 + rnd() * 0.03;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(noseW, noseLen, 6),
      new THREE.MeshPhongMaterial({ color: skin }));
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, -0.012 - rnd() * 0.012, 0.15);
    headGrp.add(nose);

    // گونه‌ی برجسته‌تر برای بعضی چهره‌ها
    if (rnd() < 0.5) {
      [-1, 1].forEach(s => {
        const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8),
          new THREE.MeshPhongMaterial({ color: skin }));
        cheek.scale.set(0.6, 0.9, 0.5);
        cheek.position.set(s * 0.075, -0.045, 0.09);
        headGrp.add(cheek);
      });
    }

    // دهان — عرض متفاوت
    const mouthW = 0.05 + rnd() * 0.012;
    const mouth = new THREE.Mesh(
      new THREE.BoxGeometry(mouthW, 0.008, 0.008),
      new THREE.MeshBasicMaterial({ color: 0x8c4a4a })
    );
    mouth.position.set(0, -0.078 + rnd() * 0.006, 0.142);
    headGrp.add(mouth);
    const mouthMesh = mouth;
    const browL = brows[0], browR = brows[1];

    // عینک برای بعضی‌ها
    let hasGlasses = false;
    if (rnd() < 0.38) {
      hasGlasses = true;
      const gm = new THREE.MeshPhongMaterial({ color: 0x1f2937 });
      [-1, 1].forEach(s => {
        const frame = new THREE.Mesh(new THREE.TorusGeometry(0.033, 0.005, 6, 14), gm);
        frame.scale.set(1, 0.86, 0.8);
        frame.position.set(s * eyeSep, eyeY, 0.15);
        headGrp.add(frame);
      });
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, 0.005), gm);
      bridge.position.set(0, eyeY + 0.005, 0.152);
      headGrp.add(bridge);
    }

    // ─── پاها: ران → زانو → ساق + کفش با پاشنه ───
    const legs = [], knees = [];
    [-0.115, 0.115].forEach(x => {
      const hip = new THREE.Group();
      hip.position.set(x, -0.04, -0.01);
      hips.add(hip);

      const thigh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.085, 0.068, 0.42, 8),
        new THREE.MeshPhongMaterial({ color: pantC })
      );
      thigh.position.y = -0.21;
      thigh.castShadow = true;
      hip.add(thigh);

      const knee = new THREE.Group();
      knee.position.y = -0.43;
      hip.add(knee);

      const shin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.062, 0.05, 0.4, 8),
        new THREE.MeshPhongMaterial({ color: pantC })
      );
      shin.position.y = -0.2;
      shin.castShadow = true;
      knee.add(shin);

      const shoe = new THREE.Mesh(
        new THREE.BoxGeometry(0.125, 0.07, 0.24),
        new THREE.MeshPhongMaterial({ color: 0x18181b })
      );
      shoe.position.set(0, -0.42, 0.05);
      shoe.castShadow = true;
      knee.add(shoe);

      // زیره کفش
      const sole = new THREE.Mesh(
        new THREE.BoxGeometry(0.13, 0.025, 0.25),
        new THREE.MeshPhongMaterial({ color: 0xd6d3d1 })
      );
      sole.position.set(0, -0.462, 0.05);
      knee.add(sole);

      legs.push(hip); knees.push(knee); all.push(hip, knee);
    });

    // ─── دست‌ها: شانه (توپی) → بازو → آرنج → ساعد + آستین ───
    const arms = [], elbows = [];
    [-0.29, 0.29].forEach(x => {
      const sh = new THREE.Group();
      sh.position.set(x, 0.52, 0);   // نسبت به ستون فقرات
      sh.rotation.z = x > 0 ? -0.09 : 0.09;
      spinePivot.add(sh);

      // توپ شانه
      const shoulderBall = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 10, 10),
        new THREE.MeshPhongMaterial({ color: shirtColor })
      );
      shoulderBall.castShadow = true;
      sh.add(shoulderBall);

      const upper = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.048, 0.32, 8),
        new THREE.MeshPhongMaterial({ color: shirtColor })
      );
      upper.position.y = -0.16;
      upper.castShadow = true;
      sh.add(upper);

      const el = new THREE.Group();
      el.position.y = -0.33;
      sh.add(el);

      const fore = new THREE.Mesh(
        new THREE.CylinderGeometry(0.044, 0.038, 0.3, 8),
        new THREE.MeshPhongMaterial({ color: skin })
      );
      fore.position.y = -0.15;
      fore.castShadow = true;
      el.add(fore);

      // آستین کوتاه سر آستین
      const cuff = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 0.06, 8),
        new THREE.MeshPhongMaterial({ color: shirtDark })
      );
      cuff.position.y = -0.03;
      el.add(cuff);

      const hand = new THREE.Mesh(
        new THREE.SphereGeometry(0.052, 8, 8),
        new THREE.MeshPhongMaterial({ color: skin })
      );
      hand.position.y = -0.32;
      el.add(hand);

      arms.push(sh); elbows.push(el); all.push(sh, el);
    });

    // کوله‌پشتی برای عامل‌ها — روی ستون فقرات تا با خم‌شدن حرکت کنه
    if (person.agent) {
      const pack = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.38, 0.14),
        new THREE.MeshPhongMaterial({ color: 0x44403c })
      );
      pack.position.set(0, 0.3, -0.2);
      pack.castShadow = true;
      spinePivot.add(pack);
    }

    // ─── رجیستری مفاصل با نام‌گذاری Mixamo (برای GLB آینده و tracking) ───
    group.userData.joints = {
      'mixamorigHips': hips,
      'mixamorigSpine': spinePivot,
      'mixamorigNeck': neckPivot,
      'mixamorigHead': headGrp,
      'mixamorigLeftArm': arms[0],
      'mixamorigRightArm': arms[1],
      'mixamorigLeftForeArm': elbows[0],
      'mixamorigRightForeArm': elbows[1],
      'mixamorigLeftUpLeg': legs[0],
      'mixamorigRightUpLeg': legs[1],
      'mixamorigLeftLeg': knees[0],
      'mixamorigRightLeg': knees[1],
    };

    all.push(spinePivot, neckPivot);
    group.userData.limbs = {
      legs, knees, arms, elbows, all,
      headGrp, neckPivot, spine: spinePivot, torso, chest, eyes, mouth: mouthMesh,
      hasGlasses, isFemale,
      browL, browR, brows, headW, browY,
    };

    // مقیاس پایه ابروها برای انیمیشن برخاستن ابرو
    if (browL) { browL.baseScale = 1; browL.userData.baseScale = 1; }
    if (browR) { browR.baseScale = 1; browR.userData.baseScale = 1; }

    return group;
  }

  // انیمیشن راه رفتن انسان‌نما — چرخه گام با خم شدن زانو و آرنج
  function _animHumanoid(grp, phase, amp) {
    const L = grp.userData.limbs;
    if (!L) return;

    L.legs.forEach((hip, i) => {
      const ph = phase + i * Math.PI;
      hip.rotation.x = Math.sin(ph) * amp;
      // زانو موقع برداشتن گام به جلو خم می‌شه
      if (L.knees[i]) L.knees[i].rotation.x = Math.max(0, Math.sin(ph - 1.2)) * amp * 1.7;
    });

    L.arms.forEach((sh, i) => {
      const ph = phase + (i === 0 ? Math.PI : 0); // متضاد با پای هم‌سمت
      sh.rotation.x = Math.sin(ph) * amp * 0.6;
      if (L.elbows[i]) L.elbows[i].rotation.x = -0.35 - Math.max(0, Math.sin(ph)) * 0.35;
    });

    // خم شدن ملایم بالاتنه از مفصل کمر + تاب موقع گام
    if (L.spine) {
      L.spine.rotation.x = 0.04 + amp * 0.06;
      L.spine.rotation.z = Math.sin(phase) * 0.035;
    }
    if (L.headGrp) {
      L.headGrp.rotation.y = Math.sin(phase * 0.5) * 0.06;
    }

    // باب عمودی — فقط وقتی روی زمین (پرش خراب نشه)
    if (grp.position.y < 0.02) {
      grp.position.y = Math.abs(Math.cos(phase)) * 0.045 * (amp / 0.55);
    }
  }

  function _resetPose(grp) {
    const L = grp.userData.limbs;
    if (!L) return;
    (L.all || []).forEach(p => { p.rotation.x = 0; });
    if (L.torso) L.torso.rotation.x = 0;
    if (L.headGrp) L.headGrp.rotation.y = 0;
    grp.position.y = 0;
  }

  // ─────────────────────────────────────────────
  // آپدیت NPC در هر فریم
  // ─────────────────────────────────────────────
  function _updateNPCs(delta) {
    npcs.forEach(npc => {
      const ud = npc.userData;

      if (ud.state === 'inside') {
        // داخل ساختمون — منتظر
        ud.insideTimer -= delta;
        if (ud.insideTimer <= 0) {
          // بیرون بیا
          ud.state = 'exit';
          npc.visible = true;
          npc.rotation.x = 0;
          _resetPose(npc);
          if (ud.target) {
            npc.position.set(
              ud.target.group.position.x + (Math.random() - 0.5) * 4,
              0,
              ud.target.group.position.z + (Math.random() - 0.5) * 4
            );
          }
          ud.target = null;
          ud.waitTimer = 2 + Math.random() * 3;
        }
        return;
      }

      if (ud.state === 'exit') {
        ud.waitTimer -= delta;
        if (ud.waitTimer <= 0) ud.state = 'walk';
        // ری‌اکشن‌های محیطی وقتی ایستاده — نگاه به اطراف، تکان سر
        ud.ambT = (ud.ambT || 2) - delta;
        if (ud.ambT <= 0) {
          ud.ambT = 4 + Math.random() * 6;
          _playReaction(npc, Math.random() < 0.55 ? 'lookAround' : 'nod');
        }
        return;
      }

      // ─── حالت گفتگو: کاملاً می‌ایسته و رو به بازیکن می‌چرخه ───
      if (ud.state === 'talking') {
        if (character) {
          const targetYaw = Math.atan2(
            character.position.x - npc.position.x,
            character.position.z - npc.position.z
          );
          let dy = targetYaw - npc.rotation.y;
          while (dy >  Math.PI) dy -= Math.PI * 2;
          while (dy < -Math.PI) dy += Math.PI * 2;
          npc.rotation.y += dy * Math.min(1, delta * 5);
        }
        return; // هیچ حرکتی نداره تا دیالوگ بسته بشه
      }

      if (ud.state === 'enter') {
        // رفتن به سمت در ساختمون
        if (!ud.target) { ud.state = 'walk'; return; }
        const tx = ud.target.group.position.x;
        const tz = ud.target.group.position.z;
        const dx = tx - npc.position.x;
        const dz = tz - npc.position.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        if (dist < 2.5) {
          // رسید — برو داخل
          npc.visible = false;
          ud.state = 'inside';
          ud.insideTimer = 4 + Math.random() * 8;
        } else {
          // حرکت به سمت ساختمون
          const spd = ud.speed * delta;
          npc.position.x += (dx / dist) * spd;
          npc.position.z += (dz / dist) * spd;
          npc.rotation.y = Math.atan2(dx, dz);
          _animateNPC(npc, delta);
        }
        return;
      }

      // state = 'walk' — قدم زدن تصادفی
      if (!ud.path || ud.pathIdx >= ud.path.length) {
        // انتخاب مسیر جدید — گاهی به سمت ساختمون
        const goToBuilding = Math.random() < 0.3 && buildings.length > 0;
        if (goToBuilding) {
          const accBuildings = buildings.filter(b => b.accessible);
          if (accBuildings.length > 0) {
            ud.target = accBuildings[Math.floor(Math.random() * accBuildings.length)];
            ud.state = 'enter';
            return;
          }
        }
        // مسیر تصادفی
        ud.path = _generateRandomPath(npc.position, 3 + Math.floor(Math.random() * 4));
        ud.pathIdx = 0;
      }

      const wp = ud.path[ud.pathIdx];
      const dx = wp.x - npc.position.x;
      const dz = wp.z - npc.position.z;
      const dist = Math.sqrt(dx*dx + dz*dz);

      if (dist < 0.8) {
        ud.pathIdx++;
      } else {
        const spd = ud.speed * delta;
        const nx = npc.position.x + (dx / dist) * spd;
        const nz = npc.position.z + (dz / dist) * spd;
        if (!_collidesSmall(nx, nz, 0.5)) {
          npc.position.x = nx;
          npc.position.z = nz;
        } else {
          ud.path = []; // مسیر جدید
        }
        npc.rotation.y = Math.atan2(dx, dz);
        _animateNPC(npc, delta);
      }
    });
  }

  // انیمیشن NPC — پایه + لایه ری‌اکشن + لایه tracking (معماری Codrops)
  function _animateNPC(npc, delta) {
    const ud = npc.userData;
    const L = npc.userData.limbs;
    if (!L) return;
    const now = performance.now() * 0.001;

    // ─── ۱) لایه پایه: مدل GLB یا اسکلت رویه‌ای ───
    if (ud.gltf) {
      // انیمیشن‌های میکسامو با AnimationMixer + Clock (سرعت مستقل از فریم)
      ud.gltf.mixer.update(delta);
    } else if (ud.state === 'walk' || ud.state === 'enter') {
      ud.phase += delta * (ud.speed * 2.2 + 3);
      _animHumanoid(npc, ud.phase, 0.5);
    } else {
      // ایستاده/گفتگو — تنفس آرام
      const br = 1 + Math.sin(now * 2 + ud.phase) * 0.025;
      if (L.chest) L.chest.scale.set(br, 1, br);
      L.arms.forEach((sh, i) => { sh.rotation.x = Math.sin(now * 1.4 + i * 2.1) * 0.04; });
      npc.position.y = 0;

      // برگشت نرم بالاتنه به حالت خنثی (جلوگیری از انباشت لایه‌ها)
      const dcy = Math.min(1, delta * 5);
      if (L.spine) {
        L.spine.rotation.x *= (1 - dcy);
        L.spine.rotation.z *= (1 - dcy);
      }
      if (L.headGrp) L.headGrp.rotation.y *= (1 - dcy);
    }

    // ─── ۲) لایه ری‌اکشن (کلیپ رویه‌ای با crossfade وزنی) ───
    _applyReactionLayer(npc, delta);

    // ─── ۳) لایه آگاهی: گردن و کمر به سمت بازیکن ───
    _applyTrackingLayer(npc, delta);

    // ─── پلک زدن دوره‌ای (فقط رویه‌ای — مدل GLB خودش دارد) ───
    if (!ud.gltf) {
      ud.blinkT -= delta;
      if (ud.blinkT <= 0) {
        ud.blinkT = 2.5 + Math.random() * 3.5;
        ud.blinkPhase = 0.13;
      }
      if (ud.blinkPhase > 0) {
        ud.blinkPhase -= delta;
        const closed = ud.blinkPhase > 0;
        if (L.eyes) L.eyes.forEach(e => { e.scale.y = closed ? 0.12 : 1; });
      }
    }
  }

  // شروع یک کلیپ ری‌اکشن — currentlyAnimating جلوی تداخل می‌گیره
  function _playReaction(npc, name, opts) {
    const def = NPC_REACTIONS[name];
    if (!def) return false;
    const ud = npc.userData;
    if (ud.reac && !ud.reac.loop && ud.reac.t < ud.reac.dur * 0.7) return false;

    // مسیر GLB: اگر کلیپ همنام در میکسامو بود، crossfade به آن
    if (ud.gltf && ud.gltf.actions[name]) {
      const a = ud.gltf.actions[name];
      a.reset().setLoop(def.loop ? THREE.LoopRepeat : THREE.LoopOnce, def.loop ? Infinity : 1);
      a.clampWhenFinished = true;
      a.fadeIn(0.25).play();
      ud.reac = { name, t: 0, dur: def.dur, loop: !!def.loop, fn: def.fn, useClip: true };
      return true;
    }

    ud.reac = { name, t: 0, dur: def.dur, loop: !!def.loop, fn: def.fn };
    return true;
  }

  // اعمال افست‌های کلیپ فعال روی مفاصل (additive روی لایه پایه)
  function _applyReactionLayer(npc, delta) {
    const ud = npc.userData;
    const R = ud.reac;
    if (!R) return;

    R.t += delta / R.dur;
    let w = 1;
    if (!R.loop) {
      if (R.t >= 1) {
        // خروج نرم از کلیپ GLB در صورت وجود
        if (R.useClip && ud.gltf && ud.gltf.actions[R.name]) {
          ud.gltf.actions[R.name].fadeOut(0.25);
        }
        ud.reac = null;
        return;
      }
      w = Math.sin(R.t * Math.PI); // ورود/خروج نرم (crossfade)
    } else if (R.t >= 1) {
      R.t %= 1;
    }

    // کلیپ GLB خودش بدنه را حرکت می‌دهد؛ فقط افست رویه‌ای حذف می‌شود
    if (R.useClip) return;

    const off = R.fn(Math.min(1, R.t));
    const J = ud.joints, L = ud.limbs;
    if (!J || !L) return;

    if (off.neck && J['mixamorigNeck']) {
      J['mixamorigNeck'].rotation.x += (off.neck.x || 0) * w;
      J['mixamorigNeck'].rotation.y += (off.neck.y || 0) * w;
    }
    if (off.spine && J['mixamorigSpine']) {
      J['mixamorigSpine'].rotation.x += (off.spine.x || 0) * w;
      J['mixamorigSpine'].rotation.y += (off.spine.y || 0) * w;
    }
    if (off.armR && J['mixamorigRightArm']) {
      J['mixamorigRightArm'].rotation.x += (off.armR.x || 0) * w;
      J['mixamorigRightArm'].rotation.z += ((off.armR.z || 0)) * w;
    }
    if (off.armL && J['mixamorigLeftArm']) {
      J['mixamorigLeftArm'].rotation.x += (off.armL.x || 0) * w;
      J['mixamorigLeftArm'].rotation.z += (off.armL.z || 0) * w;
    }
    if (off.elbR && J['mixamorigRightForeArm']) J['mixamorigRightForeArm'].rotation.x += off.elbR.x * w;
    if (off.elbL && J['mixamorigLeftForeArm']) J['mixamorigLeftForeArm'].rotation.x += off.elbL.x * w;
    if (off.handWave && J['mixamorigRightArm']) {
      // تاب دست هنگام سلام دادن — چرخش حول محور بازو
      J['mixamorigRightArm'].rotation.y += off.handWave * w;
    }
    if (off.mouth && L.mouth) {
      L.mouth.scale.y = 1 + off.mouth * w * 6;
    }
    if (off.head && J['mixamorigHead']) {
      J['mixamorigHead'].rotation.x += (off.head.x || 0) * w;
      J['mixamorigHead'].rotation.y += (off.head.y || 0) * w;
    }
    // شانه: بالا آمدن هر دو شانه (مثلاً هنگام شانه بالا انداختن)
    if (off.shoulder && J['mixamorigRightArm'] && J['mixamorigLeftArm']) {
      J['mixamorigRightArm'].rotation.z += off.shoulder * w;
      J['mixamorigLeftArm'].rotation.z += -off.shoulder * w;
    }
    // چرخش لگن (وزن جابه‌جا می‌شه) — برای ایستادن زنده
    if (off.hip && J['mixamorigHips']) {
      J['mixamorigHips'].rotation.y += (off.hip.y || 0) * w;
    }
    // ابرو: برخاستن طبیعی
    if (off.brow && L.browL && L.browR) {
      const raise = off.brow * w;
      L.browL.scale.y = L.browL.baseScale + raise;
      L.browR.scale.y = L.browR.baseScale + raise;
    }
    if (off.browL && L.browL) L.browL.scale.y = L.browL.baseScale + off.browL * w;
  }

  // محاسبه هدف گردن/کمر به سمت بازیکن (الگوی getMouseDegrees/moveJoint)
  function _computeTrackingTargets(npc) {
    if (!character || !npc.visible) return null;
    const dx = character.position.x - npc.position.x;
    const dz = character.position.z - npc.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 8) return null;

    // اختلاف زاویه در فضای محلی NPC
    let yawDiff = Math.atan2(dx, dz) - npc.rotation.y;
    while (yawDiff >  Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    // اگر بازیکن پشت سرشه، فقط تا سقف مجاز برگرده
    const pctY = Math.max(-1, Math.min(1, yawDiff / (Math.PI * 0.75)));

    // pitch بر اساس ارتفاع سر بازیکن نسبت به سر NPC
    const headWorldY = npc.position.y + 1.75 * npc.scale.y;
    const dy = (character.position.y + 1.6) - headWorldY;
    const pctX = Math.max(-1, Math.min(1, dy / Math.max(2, dist)));

    return {
      neckY: (pctY * NECK_MAX_DEG) * (Math.PI / 180),
      neckX: (-pctX * NECK_MAX_DEG * 0.5) * (Math.PI / 180),
      spineY: (pctY * SPINE_MAX_DEG) * (Math.PI / 180),
      spineX: (-pctX * SPINE_MAX_DEG * 0.4) * (Math.PI / 180),
    };
  }

  function _applyTrackingLayer(npc, delta) {
    const ud = npc.userData;
    const target = _computeTrackingTargets(npc);
    ud.trackCur = ud.trackCur || { neckY: 0, neckX: 0, spineY: 0, spineX: 0 };
    const cur = ud.trackCur;
    const lerpF = Math.min(1, delta * 4); // نرم مثل moveJoint

    ['neckY', 'neckX', 'spineY', 'spineX'].forEach(k => {
      const t = target ? target[k] : 0;
      cur[k] += (t - cur[k]) * lerpF;
    });

    const J = ud.joints;
    if (!J) return;
    // additive روی هر چیزی که لایه‌های قبلی گذاشتن
    if (J['mixamorigNeck']) {
      J['mixamorigNeck'].rotation.y += cur.neckY;
      J['mixamorigNeck'].rotation.x += cur.neckX;
    }
    if (J['mixamorigSpine']) {
      J['mixamorigSpine'].rotation.y += cur.spineY;
      J['mixamorigSpine'].rotation.x += cur.spineX;
    }
  }

  // تولید مسیر تصادفی
  function _generateRandomPath(start, numPoints) {
    const path = [];
    let cx = start.x, cz = start.z;
    for (let i = 0; i < numPoints; i++) {
      cx += (Math.random() - 0.5) * 40;
      cz += (Math.random() - 0.5) * 40;
      cx = Math.max(-160, Math.min(160, cx));
      cz = Math.max(-160, Math.min(160, cz));
      path.push({ x: cx, z: cz });
    }
    return path;
  }

  // collision ساده برای NPC
  function _collidesSmall(x, z, radius) {
    const hitCfg = BUILDINGS_CONFIG.some(b => {
      const dx = x - b.position.x, dz = z - b.position.z;
      const hw = b.width / 2 + radius, hd = b.depth / 2 + radius;
      return Math.abs(dx) < hw && Math.abs(dz) < hd;
    });
    if (hitCfg) return true;
    return staticColliders.some(c =>
      x > c.x - c.hw - radius && x < c.x + c.hw + radius &&
      z > c.z - c.hd - radius && z < c.z + c.hd + radius
    );
  }

  // ─────────────────────────────────────────────
  // هلی‌کوپتر — بدنه واقعی با نورافکن متحرک
  // ─────────────────────────────────────────────
  function _buildHelicopter() {
    helicopter = new THREE.Group();

    const bodyM  = new THREE.MeshPhongMaterial({ color: 0x3d4f2f, shininess: 70 });
    const bodyDk = new THREE.MeshPhongMaterial({ color: 0x2c3a22, shininess: 50 });
    const glassM = new THREE.MeshPhongMaterial({ color: 0x9fd3f5, transparent: true, opacity: 0.5, shininess: 160 });
    const darkM  = new THREE.MeshPhongMaterial({ color: 0x1a1a2e });
    const steelM = new THREE.MeshPhongMaterial({ color: 0x9ca3af, shininess: 120 });

    // ─── بدنه اصلی بیضی کشیده ───
    const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), bodyM);
    hull.scale.set(1.12, 0.88, 2.25);
    hull.castShadow = true;
    helicopter.add(hull);

    // کف صاف زیر بدنه
    const belly = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.3, 3.6), bodyDk);
    belly.position.y = -0.62;
    belly.castShadow = true;
    helicopter.add(belly);

    // ─── کابین شیشه‌ای حبابی جلو + فریم‌ها ───
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.92, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.7),
      glassM
    );
    canopy.scale.set(0.98, 0.85, 1.15);
    canopy.position.set(0, 0.28, 1.15);
    helicopter.add(canopy);

    // فریم شیشه‌ها
    [-0.5, 0, 0.5].forEach((fx, i) => {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.62, 0.06), bodyDk);
      frame.position.set(fx * 0.95, 0.42, 1.72 - i * 0.28);
      frame.rotation.x = -0.35;
      helicopter.add(frame);
    });

    // پنجره‌های گرد کناری
    [-1, 1].forEach(s => {
      const win = new THREE.Mesh(new THREE.CircleGeometry(0.26, 14), glassM);
      win.position.set(s * 1.08, 0.22, 0.35);
      win.rotation.y = s * Math.PI / 2;
      helicopter.add(win);
    });

    // درهای کنار + دستگیره
    [-1, 1].forEach(s => {
      const doorLine = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.75, 0.03), darkM);
      doorLine.position.set(s * 1.11, -0.05, 0.85);
      helicopter.add(doorLine);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.16), steelM);
      handle.position.set(s * 1.13, 0.05, 0.45);
      helicopter.add(handle);
    });

    // ─── موتور و اگزوز ───
    const engine = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.5, 1.7), bodyDk);
    engine.position.set(0, 0.78, -0.5);
    engine.castShadow = true;
    helicopter.add(engine);
    const intake = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 10), darkM);
    intake.rotation.x = Math.PI / 2;
    intake.position.set(-0.35, 0.82, 0.4);
    helicopter.add(intake);
    [-0.45, 0.45].forEach(x => {
      const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.45, 8), steelM);
      ex.position.set(x, 0.68, -1.45);
      ex.rotation.x = 0.5;
      helicopter.add(ex);
    });

    // ─── دم بوم + فین + استابیلایزر ───
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.32, 4.3, 10), bodyM);
    boom.rotation.x = Math.PI / 2;
    boom.position.set(0, 0.12, -3.65);
    boom.castShadow = true;
    helicopter.add(boom);

    const finV = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.25, 0.85), bodyM);
    finV.position.set(0, 0.78, -5.35);
    finV.rotation.x = 0.25;
    finV.castShadow = true;
    helicopter.add(finV);

    const hStabL = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.45), bodyM);
    hStabL.position.set(0, 0.38, -4.95);
    helicopter.add(hStabL);

    // ─── دکل روتور اصلی ───
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.55, 8), darkM);
    mast.position.y = 1.15;
    helicopter.add(mast);

    // ─── روتور اصلی (نام حفظ شده) ───
    const mainRotorGroup = new THREE.Group();
    mainRotorGroup.name = 'mainRotor';
    mainRotorGroup.position.y = 1.48;

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.2, 10), darkM);
    mainRotorGroup.add(hub);
    for (let i = 0; i < 4; i++) {
      const armPivot = new THREE.Group();
      armPivot.rotation.y = (i / 4) * Math.PI * 2;

      const blade = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.07, 0.34), darkM);
      blade.position.x = 2.85;   // از توپ به بیرون
      blade.rotation.z = 0.04;   // کونینگ ملایم رو به بالا
      blade.castShadow = true;
      armPivot.add(blade);

      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 6), steelM);
      grip.rotation.z = Math.PI / 2;
      grip.position.x = 0.35;
      armPivot.add(grip);

      mainRotorGroup.add(armPivot);
    }
    helicopter.add(mainRotorGroup);

    // ─── روتور دُم (۳ پرده) ───
    const tailRotorGroup = new THREE.Group();
    tailRotorGroup.name = 'tailRotor';
    tailRotorGroup.position.set(0.24, 0.85, -5.45);
    for (let i = 0; i < 3; i++) {
      const pivot = new THREE.Group();
      pivot.rotation.x = (i / 3) * Math.PI * 2;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.35, 0.13), darkM);
      blade.position.y = 0.68;
      pivot.add(blade);
      tailRotorGroup.add(pivot);
    }
    const trHub = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), steelM);
    tailRotorGroup.add(trHub);
    helicopter.add(tailRotorGroup);

    // ─── اسکیدهای فرود با نوخاسته جلو ───
    [-1, 1].forEach(s => {
      const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 3.1, 8), darkM);
      skid.rotation.x = Math.PI / 2;
      skid.position.set(s * 0.95, -1.02, 0);
      skid.castShadow = true;
      helicopter.add(skid);

      const tipF = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.035, 0.5, 8), darkM);
      tipF.rotation.x = -Math.PI / 3.2;
      tipF.position.set(s * 0.95, -0.86, 1.62);
      helicopter.add(tipF);

      // استرات‌های اتصال اسکید به بدنه
      [[-1.02, 1.0], [1.02, 1.0], [-1.02, -1.1], [1.02, -1.1]].forEach(([sx, sz]) => {
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.78, 6), steelM);
        strut.position.set(s * Math.abs(sx), -0.64, sz);
        strut.rotation.z = s * 0.3;   // شیب به بیرون
        strut.castShadow = true;
        helicopter.add(strut);
      });
    });

    // ─── نورافکن جلو با پرتو مخروطی (نام searchBeam) ───
    const spotHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.18, 10), darkM);
    spotHousing.position.set(0, -0.52, 1.75);
    spotHousing.rotation.x = 1.1;
    helicopter.add(spotHousing);

    const beamPivot = new THREE.Group();
    beamPivot.name = 'searchBeam';
    beamPivot.position.set(0, -0.52, 1.75);
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 3.4, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff8d8, transparent: true, opacity: 0.1, side: THREE.DoubleSide })
    );
    beam.position.y = -1.7; // مخروط رو به پایین-جلو
    beam.rotation.x = Math.PI;
    beamPivot.add(beam);
    beamPivot.rotation.x = 0.55;
    helicopter.add(beamPivot);

    // چراغ چشمک‌زن (نام heliLight حفظ شده)
    const heliLight = new THREE.PointLight(0xff0000, 1.5, 8);
    heliLight.name = 'heliLight';
    heliLight.position.set(0, -0.3, 2.3);
    helicopter.add(heliLight);
    const beaconMesh = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    beaconMesh.position.set(0, 1.02, -1.2);
    helicopter.add(beaconMesh);

    // آنتن زیر دم
    const antWire = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 4), darkM);
    antWire.position.set(0, -0.35, -3.2);
    helicopter.add(antWire);

    // برچسب
    const heliLabel = _makeTextSprite('🚁 هلی‌کوپتر', '#60a5fa');
    heliLabel.position.set(0, 3.5, 0);
    heliLabel.scale.set(4, 1.4, 1);
    helicopter.add(heliLabel);

    // موقعیت اولیه
    helicopter.position.set(helicopterRadius, helicopterHeight, 0);
    scene.add(helicopter);

    // پد فرود
    _buildHeliport();
  }

  function _buildHeliport() {
    const pad = new THREE.Group();

    const slab = new THREE.Mesh(
      new THREE.CylinderGeometry(7, 7.6, 0.4, 24),
      new THREE.MeshPhongMaterial({ color: 0x334155 })
    );
    slab.position.y = 0.2;
    slab.receiveShadow = true;
    pad.add(slab);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(5.6, 0.18, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.45;
    pad.add(ring);

    const hMark = _makeTextSprite('H', '#facc15');
    hMark.position.set(0, 1, 0);
    hMark.scale.set(3, 1.4, 1);
    pad.add(hMark);
    labels.push(hMark);

    pad.position.set(HELI_PAD_POS.x, 0, HELI_PAD_POS.z);
    scene.add(pad);
  }

  function _updateHelicopter(delta) {
    if (!helicopter) return;

    // سرعت روتور بر اساس حالت
    const targetRotor = heliState === 'landed' ? 0
      : (heliState === 'toPad' || heliState === 'landing' || heliState === 'takeoff') ? 12 : 18;
    rotorSpeed += (targetRotor - rotorSpeed) * Math.min(1, delta * 2);

    const mr = helicopter.getObjectByName('mainRotor');
    if (mr) mr.rotation.y += delta * rotorSpeed * 2;
    const tr = helicopter.getObjectByName('tailRotor');
    if (tr) tr.rotation.x += delta * rotorSpeed * 2.5;

    // چشمک نور قرمز
    const hl = helicopter.getObjectByName('heliLight');
    if (hl) hl.intensity = (rotorSpeed > 2 && Math.sin(Date.now() * 0.01) > 0) ? 2 : 0;

    // نورافکن جست‌وجو با چرخش خودکار
    const beamPivot = helicopter.getObjectByName('searchBeam');
    if (beamPivot) {
      beamPivot.rotation.x = 0.55 + Math.sin(Date.now() * 0.0012) * 0.22;
      beamPivot.rotation.y = Math.sin(Date.now() * 0.0007) * 0.45;
    }

    const px = HELI_PAD_POS.x, pz = HELI_PAD_POS.z;

    switch (heliState) {
      case 'patrol': {
        helicopterAngle += HELI_SPEED;
        helicopter.position.x = Math.cos(helicopterAngle) * helicopterRadius;
        helicopter.position.z = Math.sin(helicopterAngle) * helicopterRadius;
        helicopter.position.y = helicopterHeight + Math.sin(helicopterAngle * 3) * 2;
        helicopter.rotation.y = -helicopterAngle + Math.PI / 2;

        // اگه بازیکن نزدیک پد بود، بیاد فرود
        if (!inHeli && !inCar && !inTank) {
          const dxp = character.position.x - px;
          const dzp = character.position.z - pz;
          if (Math.sqrt(dxp * dxp + dzp * dzp) < 22) heliState = 'toPad';
        }
        break;
      }
      case 'toPad': {
        _heliFlyToward(px, HELI_CRUISE, pz, delta, 12);
        if (_heliNear(px, HELI_CRUISE, pz, 1.5)) heliState = 'landing';
        break;
      }
      case 'landing': {
        _heliFlyToward(px, 0.85, pz, delta, 9);
        if (_heliNear(px, 0.85, pz, 0.25)) {
          helicopter.position.set(px, 0.85, pz);
          heliState = 'landed';
          heliWaitTimer = 0;
          if (inHeli) _finishHeliExit();
        }
        break;
      }
      case 'landed': {
        heliWaitTimer += delta;
        const dxp = character.position.x - px;
        const dzp = character.position.z - pz;
        const playerFar = Math.sqrt(dxp * dxp + dzp * dzp) > 26;
        if (!inHeli && heliWaitTimer > 10 && playerFar) heliState = 'takeoff';
        break;
      }
      case 'takeoff': {
        helicopter.position.y += 10 * delta;
        if (helicopter.position.y >= HELI_CRUISE) {
          helicopter.position.y = HELI_CRUISE;
          if (inHeli) {
            heliState = 'player';
            _showToast('🚁 کنترل دست شماست — H برای فرود خودکار');
          } else {
            // برگه به گشت‌زنی بدون پرش ناگهانی
            helicopterAngle = Math.atan2(helicopter.position.z, helicopter.position.x);
            heliState = 'patrol';
          }
        }
        break;
      }
      case 'player':
        // کنترل توسط بازیکن در _updateHelicopterFlight
        break;
    }

    // تیلت بصری بدنه هنگام پرواز
    let targetTilt = 0;
    if (heliState === 'player') {
      targetTilt = (keys.w || keys.ArrowUp) ? -0.22 : (keys.s || keys.ArrowDown) ? 0.18 : 0;
    }
    helicopter.rotation.x += (targetTilt - helicopter.rotation.x) * Math.min(1, delta * 4);
  }

  function _heliFlyToward(tx, ty, tz, delta, speed) {
    const dx = tx - helicopter.position.x;
    const dy = ty - helicopter.position.y;
    const dz = tz - helicopter.position.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const step = Math.min(speed * delta, dist);
    helicopter.position.x += (dx / dist) * step;
    helicopter.position.y += (dy / dist) * step;
    helicopter.position.z += (dz / dist) * step;
  }

  function _heliNear(tx, ty, tz, eps) {
    return Math.abs(helicopter.position.x - tx) < eps &&
           Math.abs(helicopter.position.y - ty) < eps &&
           Math.abs(helicopter.position.z - tz) < eps;
  }

  function _mountHelicopter() {
    if (heliState !== 'landed') return;
    inHeli = true;
    heliWaitTimer = 0;
    vertVel = 0;
    character.visible = false;
    const lbl = helicopter.children.find(c => c.isSprite);
    if (lbl) lbl.visible = false;
    heliState = 'takeoff';
    _showToast('🚁 برخاست — W/S حرکت، A/D چرخش، Space/Shift ارتفاع، چپ‌کلیک شلیک، H فرود');
    const hint = document.getElementById('city-controls-hint');
    if (hint) hint.innerHTML = `
      <p><span class="key">W</span><span class="key">S</span> — جلو / عقب</p>
      <p><span class="key">A</span><span class="key">D</span> — چرخش</p>
      <p><span class="key">Space</span> / <span class="key">Shift</span> — بالا / پایین</p>
      <p><span class="key">چپ‌کلیک</span> — شلیک · <span class="key">راست‌کلیک</span> — نشانه‌گیری</p>
      <p><span class="key">H</span> — فرود خودکار و پیاده شدن</p>`;
  }

  function _requestHeliLand() {
    if (heliState !== 'player') return;
    heliState = 'toPad';
    _showToast('🚁 در حال بازگشت به پد فرود...');
  }

  function _finishHeliExit() {
    inHeli = false;
    character.visible = true;
    character.position.set(HELI_PAD_POS.x + 9.5, 0, HELI_PAD_POS.z + 3);
    character.rotation.y = 0;
    vertVel = 0;
    const lbl = helicopter.children.find(c => c.isSprite);
    if (lbl) lbl.visible = true;
    _showToast('🚶 پیاده شدید');
    _resetControlsHint();
  }

  function _updateHelicopterFlight(delta) {
    if (heliState !== 'player') return; // حین takeoff/landing کنترل با autopilot

    const yaw = helicopter.rotation.y;
    const fwd  = (keys.w || keys.ArrowUp) ? 1 : (keys.s || keys.ArrowDown) ? -1 : 0;
    const turn = (keys.a || keys.ArrowLeft) ? 1 : (keys.d || keys.ArrowRight) ? -1 : 0;
    let up = 0;
    if (keys[' ']) up = 1;
    else if (keys.Shift) up = -1;

    helicopter.rotation.y += turn * 1.4 * delta;

    const spd = 26;
    if (fwd !== 0) {
      const nx = helicopter.position.x + Math.sin(yaw) * fwd * spd * delta;
      const nz = helicopter.position.z + Math.cos(yaw) * fwd * spd * delta;
      if (!_collidesLarge(nx, nz, 3, 3)) {
        helicopter.position.x = nx;
        helicopter.position.z = nz;
      }
    }

    helicopter.position.y = Math.max(HELI_MIN_ALT, Math.min(HELI_MAX_ALT, helicopter.position.y + up * 14 * delta));
    helicopter.position.x = Math.max(-260, Math.min(260, helicopter.position.x));
    helicopter.position.z = Math.max(-260, Math.min(260, helicopter.position.z));
  }

  // ─────────────────────────────────────────────
  // دیالوگ با NPC — مکالمه ساده فارسی
  // ─────────────────────────────────────────────
  // گفتگو با NPC = ثبت وظیفه صوتی ۳ مرحله‌ای
  //  مرحله ۱: NPC سوال می‌کنه → کاربر عنوان می‌گه
  //  مرحله ۲: NPC «اوه بعدش چی؟» می‌گه → کاربر توضیحات می‌گه
  //  مرحله ۳: NPC «باشه بهت خبر میدم» می‌گه → ذخیره + بستن
  // ─────────────────────────────────────────────

  // ─── Speech synthesis helper ───
  function _npcSpeak(text, onEnd) {
    if (!window.speechSynthesis) { if (onEnd) onEnd(); return; }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'fa-IR';
    utt.rate = 1.05;
    utt.pitch = 1.0;
    // انتخاب صدای فارسی اگر موجود باشد
    const voices = window.speechSynthesis.getVoices();
    const faVoice = voices.find(v => v.lang.startsWith('fa')) || voices[0];
    if (faVoice) utt.voice = faVoice;
    if (onEnd) utt.onend = onEnd;
    window.speechSynthesis.speak(utt);
  }

  // ─── Web Speech Recognition helper ───
  function _listenOnce(onResult, onError) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { if (onError) onError('not-supported'); return null; }
    const rec = new SR();
    rec.lang = 'fa-IR';
    rec.continuous = false;
    rec.interimResults = true;
    let finalText = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript + ' ';
        else interim = e.results[i][0].transcript;
      }
      // نمایش متن موقت در bubble
      const tb = document.getElementById('city-dlg-user-text');
      if (tb) tb.textContent = (finalText + interim).trim();
    };
    rec.onerror = (e) => { if (onError) onError(e.error); };
    rec.onend = () => { if (onResult) onResult(finalText.trim()); };
    try { rec.start(); } catch(e) { if (onError) onError(e.message); }
    return rec;
  }

  function _buildDialogUI() {
    if (document.getElementById('city-npc-dialog')) return;
    const box = document.createElement('div');
    box.id = 'city-npc-dialog';
    box.style.cssText = `
      position:fixed; bottom:0; left:0; right:0; top:0;
      display:flex; align-items:flex-end; justify-content:center;
      z-index:700; pointer-events:none; opacity:0;
      transition:opacity .3s ease; font-family:Vazirmatn,Tahoma,sans-serif;`;
    document.body.appendChild(box);

    // انیمیشن موج
    if (!document.getElementById('city-wave-style')) {
      const st = document.createElement('style');
      st.id = 'city-wave-style';
      st.textContent = `
        @keyframes cityWave{from{transform:scaleY(1);opacity:.6}to{transform:scaleY(2.4);opacity:1}}
        @keyframes cityPulse{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}
        .city-mic-pulse{animation:cityPulse .7s ease-in-out infinite}`;
      document.head.appendChild(st);
    }
  }

  // ─── متغیر مشترک برای recognition جاری ───
  let _activeRec = null;

  function _openDialog(npc) {
    if (!npc) return;
    _buildDialogUI();
    dialogOpen = true;

    if (document.exitPointerLock && document.pointerLockElement) {
      try { document.exitPointerLock(); } catch (e) {}
    }

    const ud = npc.userData;
    dialogNPC = npc;
    if (ud.state !== 'talking') ud.prevState = ud.state;
    ud.state = 'talking';
    ud.path = [];
    _startTalkLoop(npc);

    const cfgIdx = npcs.indexOf(npc);
    const hexColor = '#' + (NPC_CONFIGS[cfgIdx] ? NPC_CONFIGS[cfgIdx].color.toString(16).padStart(6,'0') : '6366f1');
    const npcUserId = _getNpcUserId(ud.name);
    const employeeId = npcUserId || _guessEmployeeId(ud.name);

    // ─── state machine ───
    // phase: 'greeting' → 'listen-title' → 'ack' → 'listen-desc' → 'save' → 'bye'
    let _phase = 'greeting';
    let _taskTitle = '';
    let _taskDesc  = '';

    const box = document.getElementById('city-npc-dialog');
    box.style.opacity = '1';
    box.style.pointerEvents = 'auto';

    // ─── UI panel ───
    box.innerHTML = `
      <div id="city-conv-panel" dir="rtl" onclick="event.stopPropagation()" style="
        width:min(440px,95vw); margin-bottom:20px;
        background:rgba(8,12,26,0.97); border:1px solid ${hexColor}55;
        border-radius:22px; overflow:hidden;
        box-shadow:0 12px 56px rgba(0,0,0,.8); backdrop-filter:blur(16px);">

        <!-- هدر -->
        <div style="display:flex;align-items:center;gap:10px;padding:14px 16px;
                    background:linear-gradient(135deg,rgba(99,102,241,.18),rgba(139,92,246,.12));
                    border-bottom:1px solid rgba(255,255,255,.07);">
          <span style="width:12px;height:12px;border-radius:50%;flex:none;
                background:${hexColor};box-shadow:0 0 10px ${hexColor};"></span>
          <strong style="font-size:.95rem;color:#e2e8f0;">${ud.name}</strong>
          <span style="font-size:.65rem;background:rgba(99,102,241,.3);border:1px solid rgba(99,102,241,.4);
                padding:2px 8px;border-radius:999px;color:#c7d2fe;margin-right:auto;">
            ${ud.role === 'agent' ? '🔧 عامل' : '👤 کارمند'}
          </span>
          <button id="city-dlg-close-btn" style="
            background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);
            color:#94a3b8;width:26px;height:26px;border-radius:8px;cursor:pointer;font-size:.8rem;">✕</button>
        </div>

        <!-- حباب گفتگو -->
        <div style="padding:14px 16px 10px; min-height:90px;">
          <!-- حباب NPC -->
          <div id="city-dlg-npc-bubble" style="
            display:flex;gap:8px;align-items:flex-start;margin-bottom:10px;">
            <div style="width:32px;height:32px;border-radius:50%;flex:none;
                  background:${hexColor};display:flex;align-items:center;justify-content:center;
                  font-size:.85rem;font-weight:700;color:#fff;">
              ${ud.name.charAt(0)}
            </div>
            <div id="city-dlg-npc-text" style="
              background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.25);
              border-radius:0 12px 12px 12px;padding:8px 12px;
              font-size:.87rem;color:#e2e8f0;line-height:1.7;max-width:320px;">
              ...
            </div>
          </div>
          <!-- حباب کاربر -->
          <div id="city-dlg-user-bubble" style="
            display:none;justify-content:flex-start;flex-direction:row-reverse;
            gap:8px;align-items:flex-start;">
            <div style="width:28px;height:28px;border-radius:50%;flex:none;
                  background:#4f46e5;display:flex;align-items:center;justify-content:center;
                  font-size:.75rem;color:#fff;">🧑</div>
            <div id="city-dlg-user-text" style="
              background:rgba(79,70,229,.2);border:1px solid rgba(79,70,229,.35);
              border-radius:12px 0 12px 12px;padding:8px 12px;
              font-size:.85rem;color:#c7d2fe;line-height:1.6;max-width:300px;
              font-style:italic;min-height:18px;"></div>
          </div>
        </div>

        <!-- نوار وضعیت میکروفن -->
        <div id="city-dlg-mic-bar" style="
          padding:10px 16px 14px;display:flex;align-items:center;
          justify-content:center;gap:8px;">
          <div id="city-dlg-waves" style="display:none;gap:2px;align-items:flex-end;height:18px;">
            ${[4,7,5,9,6,8,4,7,5].map((h,i)=>
              `<div style="width:3px;background:#6366f1;border-radius:2px;height:${h}px;
                animation:cityWave .55s ${i*.06}s ease-in-out infinite alternate;"></div>`
            ).join('')}
          </div>
          <span id="city-dlg-status" style="font-size:.75rem;color:#64748b;">در حال آماده‌سازی...</span>
        </div>
      </div>`;

    const npcTextEl  = document.getElementById('city-dlg-npc-text');
    const userBubble = document.getElementById('city-dlg-user-bubble');
    const userTextEl = document.getElementById('city-dlg-user-text');
    const waveEl     = document.getElementById('city-dlg-waves');
    const statusEl   = document.getElementById('city-dlg-status');

    // دکمه بستن
    const closeBtn = document.getElementById('city-dlg-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); _closeDialog(); });

    function _setNpcText(t)  { if (npcTextEl) npcTextEl.textContent = t; }
    function _setStatus(t)   { if (statusEl) statusEl.textContent = t; }
    function _showMic(on)    {
      if (waveEl) waveEl.style.display = on ? 'flex' : 'none';
      _setStatus(on ? '🎤 در حال گوش دادن...' : '');
    }
    function _showUserBubble(on) {
      if (userBubble) userBubble.style.display = on ? 'flex' : 'none';
      if (!on && userTextEl) userTextEl.textContent = '';
    }

    // ─── ماشین حالت گفتگو ───
    function _runPhase() {
      if (_phase === 'greeting') {
        _setNpcText('چه کمکی از دستم برمیاد؟');
        _setStatus('');
        _npcSpeak('چه کمکی از دستم برمیاد؟', () => {
          _phase = 'listen-title';
          _runPhase();
        });

      } else if (_phase === 'listen-title') {
        _setStatus('🎤 عنوان وظیفه را بگویید...');
        _showMic(true);
        _showUserBubble(true);
        userTextEl.textContent = '';

        _activeRec = _listenOnce(
          (text) => {
            _activeRec = null;
            _showMic(false);
            if (!text) {
              // اگه چیزی نگفت دوباره گوش بده
              _setStatus('⚠️ چیزی شنیده نشد، دوباره بگویید...');
              setTimeout(() => { if (dialogOpen) _runPhase(); }, 900);
              return;
            }
            _taskTitle = text;
            userTextEl.textContent = text;
            _phase = 'ack';
            setTimeout(() => { if (dialogOpen) _runPhase(); }, 400);
          },
          (err) => {
            _activeRec = null;
            _showMic(false);
            if (err === 'not-supported') {
              _setNpcText('متأسفم، مرورگر شما تشخیص صوت ندارد.');
              _setStatus('لطفاً از Chrome استفاده کنید');
            } else {
              _setStatus('⚠️ مشکل در دسترسی به میکروفن: ' + err);
              setTimeout(() => { if (dialogOpen) _runPhase(); }, 1200);
            }
          }
        );

      } else if (_phase === 'ack') {
        _showUserBubble(false);
        _setNpcText('اها! بعدش چی؟');
        _npcSpeak('اها! بعدش چی؟', () => {
          _phase = 'listen-desc';
          _runPhase();
        });

      } else if (_phase === 'listen-desc') {
        _setStatus('🎤 توضیحات وظیفه را بگویید...');
        _showMic(true);
        _showUserBubble(true);
        userTextEl.textContent = '';

        _activeRec = _listenOnce(
          (text) => {
            _activeRec = null;
            _showMic(false);
            _taskDesc = text || '';
            if (text) userTextEl.textContent = text;
            _phase = 'save';
            setTimeout(() => { if (dialogOpen) _runPhase(); }, 300);
          },
          (err) => {
            _activeRec = null;
            _showMic(false);
            // توضیحات اختیاری — اگه خطا داد ادامه بده
            _taskDesc = '';
            _phase = 'save';
            setTimeout(() => { if (dialogOpen) _runPhase(); }, 400);
          }
        );

      } else if (_phase === 'save') {
        _showUserBubble(false);
        _setStatus('');

        if (!_taskTitle) {
          // عنوان نداریم — برگرد به اول
          _phase = 'greeting';
          _runPhase();
          return;
        }

        // ذخیره وظیفه
        if (!employeeId) {
          _setNpcText('متأسفم، نتونستم اطلاعاتت رو پیدا کنم!');
          _setStatus('⚠️ کاربر NPC در سیستم یافت نشد');
          setTimeout(() => _closeDialog(), 2000);
          return;
        }

        const now = new Date();
        const due = new Date(now);
        due.setDate(due.getDate() + 3);

        const task = {
          id:         'task_3d_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
          title:      _taskTitle,
          description: _taskDesc,
          status:     'pending',
          priority:   'medium',
          dueDate:    due.toISOString().split('T')[0],
          createdAt:  now.toISOString(),
          createdBy:  '3d-world',
          assignedBy: currentUserRole,
          source:     'city-world',
        };

        try {
          const tasksData = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
          if (!tasksData[employeeId]) tasksData[employeeId] = [];
          tasksData[employeeId].unshift(task);
          localStorage.setItem('employee_tasks', JSON.stringify(tasksData));

          if (typeof TasksModule !== 'undefined' && typeof TasksModule.saveemployeeTasks === 'function') {
            TasksModule.saveemployeeTasks(employeeId, tasksData[employeeId]);
          }
        } catch(e) {
          console.warn('[3D] task save error:', e);
        }

        _phase = 'bye';
        _runPhase();

      } else if (_phase === 'bye') {
        _setNpcText('باشه، بهت خبر میدم! 👍');
        _setStatus('');
        _showToast('📋 وظیفه «' + _taskTitle + '» برای ' + ud.name + ' ثبت شد');
        _npcSpeak('باشه، بهت خبر میدم!', () => {
          setTimeout(() => _closeDialog(), 700);
        });
      }
    }

    // شروع مکالمه
    setTimeout(() => { if (dialogOpen) _runPhase(); }, 200);
  }

  // پیدا کردن user ID بر اساس نام NPC
  function _getNpcUserId(npcName) {
    if (typeof HARDCODED_USERS === 'undefined') return null;
    const nameMap = {
      'سارا':   u => u.name?.includes('سارا')    || u.username === 'sareh',
      'زینب':   u => u.name?.includes('زینب')    || u.username === 'zainab',
      'فرزاد':  u => u.name?.includes('فرزاد')   || u.username === 'farzad',
      'فاضلی':  u => u.name?.includes('فاضلی')   || u.username === 'fazeli',
      'دکتر':   u => u.name?.includes('خدایاری') || u.username === 'mahdi',
      'معصومی': u => u.name?.includes('معصومی')  || u.role === 'agent',
      '-صادقی': u => u.name?.includes('صادقی')   || u.role === 'agent',
    };
    const matcher = nameMap[npcName];
    if (!matcher) return null;
    const found = HARDCODED_USERS.find(u => u.active !== false && matcher(u));
    return found?.id || null;
  }

  function _guessEmployeeId(npcName) {
    const fallback = {
      'سارا': 'emp001', 'زینب': 'emp002', 'فرزاد': 'emp003',
      'فاضلی': 'emp004', 'دکتر': 'emp005',
      'معصومی': 'agent001', '-صادقی': 'agent002',
    };
    return fallback[npcName] || null;
  }

  // حلقه ژست گفتگو
  function _startTalkLoop(npc) {
    const def = NPC_REACTIONS.talk;
    npc.userData.reac = { name: 'talk', t: 0, dur: def.dur, loop: true, fn: def.fn };
  }

  function _closeDialog() {
    dialogOpen = false;

    // توقف recognition در حال اجرا
    if (_activeRec) {
      try { _activeRec.stop(); } catch(e) {}
      _activeRec = null;
    }

    // توقف TTS
    if (window.speechSynthesis) window.speechSynthesis.cancel();

    // آزادسازی NPC
    if (dialogNPC) {
      const ud = dialogNPC.userData;
      ud.reac = null;
      _playReaction(dialogNPC, 'wave');
      ud.state = 'walk';
      ud.path = [];
      dialogNPC = null;
    }

    const el = document.getElementById('city-npc-dialog');
    if (el) {
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      setTimeout(() => { if (el) el.innerHTML = ''; }, 300);
    }
  }

  // ─────────────────────────────────────────────
  // جنگنده — سوار شدن، پرواز، فرود خودکار
  // ─────────────────────────────────────────────
  function _mountJet() {
    if (!fighterJet || jetState !== 'parked') return;
    inJet = true;
    character.visible = false;
    jetSpeed = 0;
    jetState = 'roll'; // روی باند شروع به حرکت می‌کنه
    _showToast('✈️ در حال حرکت روی باند... نگه دار بریم!');
    const hint = document.getElementById('city-controls-hint');
    if (hint) hint.innerHTML = `
      <p><span class="key">W</span><span class="key">S</span> — گاز / ترمز</p>
      <p><span class="key">A</span><span class="key">D</span> / موس — چرخش و کج‌شدن</p>
      <p><span class="key">Space</span> / <span class="key">Shift</span> — اوج گرفتن / شیرجه</p>
      <p><span class="key">چپ‌کلیک</span> — شلیک · <span class="key">J</span> — فرود خودکار</p>`;
  }

  function _requestJetLand() {
    if (jetState !== 'player' && jetState !== 'climb') return;
    jetState = 'approach';
    _showToast('🛬 در حال بازگشت به باند برای فرود...');
  }

  function _finishJetExit() {
    inJet = false;
    jetState = 'parked';
    jetSpeed = 0;
    character.visible = true;
    character.position.set(fighterJet.position.x - 6, 0, fighterJet.position.z + 4);
    vertVel = 0;
    _showToast('🚶 از جنگنده پیاده شدید — چه پروازی!');
    _resetControlsHint();
  }

  // ماشین حالت‌های جت (autopilot + زمین)
  function _updateJet(delta) {
    if (!fighterJet) return;

    switch (jetState) {
      case 'parked':
        jetSpeed = 0;
        break;

      case 'roll': {
        // خزش روی باند تا رسیدن به محور باند
        jetSpeed = Math.min(jetSpeed + 20 * delta, 30);
        _jetMoveForward(delta);
        // هم‌تراز شدن با محور باند (رو به شرق، x افزایشی)
        fighterJet.rotation.y += ((Math.PI / 2) - fighterJet.rotation.y) * Math.min(1, delta * 2);
        fighterJet.rotation.z *= (1 - delta * 3);
        if (fighterJet.position.x >= 118 && jetSpeed >= JET_MIN_FLY) {
          jetState = 'climb';
          _showToast('🛫 برخاست! کنترل دست شماست');
        }
        break;
      }

      case 'climb': {
        jetSpeed = Math.min(jetSpeed + 14 * delta, JET_MAX_SPD);
        _jetMoveForward(delta);
        fighterJet.position.y += 16 * delta;
        fighterJet.rotation.x += ((-0.18) - fighterJet.rotation.x) * Math.min(1, delta * 2);
        if (fighterJet.position.y >= 35) {
          fighterJet.position.y = 35;
          jetState = 'player';
          _showToast('✈️ W/S گاز · A/D چرخش · Space/Shift ارتفاع · J فرود');
        }
        break;
      }

      case 'approach': {
        // رفتن به نقطه ورود باند (جنوب باند، بالا)
        const ok = _jetFlyToward(128, 32, 108, delta, 40);
        jetSpeed = Math.min(JET_MAX_SPD, Math.max(jetSpeed, 34));
        _clampJetBounds();
        if (ok) { jetState = 'final'; }
        break;
      }

      case 'final': {
        // شیب نهایی: کاهش ارتفاع در امتداد باند به سمت z=10
        jetSpeed += (26 - jetSpeed) * Math.min(1, delta * 1.5);
        const jx = fighterJet.position.x;
        fighterJet.rotation.y += ((Math.PI / 2) - fighterJet.rotation.y) * Math.min(1, delta * 2.5);

        const nx = jx + (128 - jx) * Math.min(1, delta * 2);
        const nz = fighterJet.position.z - jetSpeed * delta;
        const progress = Math.max(0, Math.min(1, (108 - fighterJet.position.z) / 96));
        const ny = Math.max(1.4, 32 * (1 - progress));

        fighterJet.position.set(nx, ny, nz);
        fighterJet.rotation.x += ((-0.05) - fighterJet.rotation.x) * Math.min(1, delta * 2);

        if (fighterJet.position.z <= 12 || ny <= 1.45) {
          // تماس با زمین
          fighterJet.position.y = 0;
          fighterJet.rotation.x = 0;
          fighterJet.rotation.z = 0;
          _showToast('🛬 فرود موفق!');
          _spawnSmoke(new THREE.Vector3(
            fighterJet.position.x - Math.sin(fighterJet.rotation.y) * 3,
            0.3,
            fighterJet.position.z - Math.cos(fighterJet.rotation.y) * 3
          ));
          setTimeout(() => { if (inJet) _finishJetExit(); }, 700);
          jetState = 'parked';
          jetSpeed = 0;
        }
        break;
      }

      case 'player':
        _updateJetFlight(delta);
        break;
    }
  }

  // حرکت مستقیم به سمت جهت فیوزلاژ
  function _jetMoveForward(delta) {
    const yaw = fighterJet.rotation.y;
    const nx = fighterJet.position.x + Math.sin(yaw) * jetSpeed * delta;
    const nz = fighterJet.position.z + Math.cos(yaw) * jetSpeed * delta;
    fighterJet.position.x = nx;
    fighterJet.position.z = nz;
    _clampJetBounds();
    // روی زمین ارتفاع صفر
    if (jetState === 'roll') fighterJet.position.y = 0;
  }

  // جت هیچ‌وقت از محدوده زمین اصلی خارج نمی‌شه
  function _clampJetBounds() {
    const p = fighterJet.position;
    let hit = false;
    if (p.x >  JET_MAP_EDGE) { p.x = JET_MAP_EDGE; hit = true; }
    if (p.x < -JET_MAP_EDGE) { p.x = -JET_MAP_EDGE; hit = true; }
    if (p.z >  JET_MAP_EDGE) { p.z = JET_MAP_EDGE; hit = true; }
    if (p.z < -JET_MAP_EDGE) { p.z = -JET_MAP_EDGE; hit = true; }
    if (hit && Date.now() - _jetEdgeToast > 3000) {
      _jetEdgeToast = Date.now();
      jetSpeed *= 0.8;
      _showToast('🚧 مرز شهر! برگرد سمت باند');
      // چرخش ملایم به سمت مرکز تا گیر نکنه
      const toCenter = Math.atan2(-p.x, -p.z);
      let diff = toCenter - fighterJet.rotation.y;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      fighterJet.rotation.y += diff * 0.25;
    }
  }

  // پرواز به سمت نقطه — برمی‌گرداند true وقتی رسید
  function _jetFlyToward(tx, ty, tz, delta, speed) {
    const dx = tx - fighterJet.position.x;
    const dy = ty - fighterJet.position.y;
    const dz = tz - fighterJet.position.z;
    const distH = Math.sqrt(dx * dx + dz * dz);
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;

    // چرخش نرم به سمت هدف
    const targetYaw = Math.atan2(dx, dz);
    let diff = targetYaw - fighterJet.rotation.y;
    while (diff >  Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    fighterJet.rotation.y += diff * Math.min(1, delta * 1.8);

    const step = Math.min(speed * delta, dist);
    fighterJet.position.x += (dx / dist) * step;
    fighterJet.position.y += (dy / dist) * step;
    fighterJet.position.z += (dz / dist) * step;
    return dist < 8;
  }

  // کنترل دستی بازیکن
  function _updateJetFlight(delta) {
    if (jetState !== 'player') return;

    const grounded = fighterJet.position.y <= 0.05;
    const throttle = (keys.w || keys.ArrowUp) ? 1 : (keys.s || keys.ArrowDown) ? -1 : 0;
    const turn = (keys.a || keys.ArrowLeft) ? 1 : (keys.d || keys.ArrowRight) ? -1 : 0;
    let climb = 0;
    if (keys[' ']) climb = 1;
    else if (keys.Shift) climb = -1;

    // گاز
    jetSpeed += throttle * 22 * delta;
    jetSpeed = Math.max(grounded ? 0 : 6, Math.min(JET_MAX_SPD, jetSpeed));

    // چرخش — رو زمین فقط با سرعت، تو هوا آزادتر
    const turnRate = grounded ? 0.7 : 1.15;
    if (Math.abs(turn) > 0 && (jetSpeed > 4 || !grounded)) {
      fighterJet.rotation.y += turn * turnRate * delta * (grounded ? Math.min(1, jetSpeed / 12) : 1);
    }

    // کج‌شدن بصری (bank)
    const targetBank = grounded ? 0 : -turn * 0.55;
    fighterJet.rotation.z += (targetBank - fighterJet.rotation.z) * Math.min(1, delta * 3);

    // ارتفاع
    if (!grounded || (climb > 0 && jetSpeed >= JET_MIN_FLY)) {
      const liftFactor = Math.min(1, jetSpeed / (JET_MIN_FLY * 1.6));
      let vy = climb * 14 * liftFactor;
      // واماندگی — سرعت کم = سقوط
      if (jetSpeed < JET_MIN_FLY) {
        vy -= (JET_MIN_FLY - jetSpeed) * 0.9;
        if (Date.now() - jetToastCd > 2500) {
          jetToastCd = Date.now();
          _showToast('⚠️ واماندگی! سرعت بیشتر (W)');
        }
      } else if (climb === 0) {
        vy -= 1.5; // آرام پایین میاد
      }
      fighterJet.position.y += vy * delta;
    }

    // برخورد با زمین/سقف
    const ceiling = 130;
    if (fighterJet.position.y >= ceiling) { fighterJet.position.y = ceiling; }
    if (fighterJet.position.y <= 0) {
      if (jetSpeed > JET_MIN_FLY + 8) {
        // فرود سریع — لرزش و کند شدن
        fighterJet.position.y = 0;
        jetSpeed *= 0.4;
        _showToast('💥 برخورد! آهسته‌تر فرود بیا');
        _spawnSmoke(fighterJet.position.clone().add(new THREE.Vector3(0, 0.5, 2)));
      } else {
        fighterJet.position.y = 0;
        if (climb >= 0) fighterJet.rotation.x *= (1 - Math.min(1, delta * 4));
      }
    }

    // تیلت دماغه با کلایمب
    const targetPitch = grounded ? 0 : (-climb * 0.28 - (jetSpeed / JET_MAX_SPD) * 0.04);
    fighterJet.rotation.x += (targetPitch - fighterJet.rotation.x) * Math.min(1, delta * 3);

    // مرز جهان — جت داخل مپ می‌مونه
    _clampJetBounds();

    // برخورد با ساختمان‌ها در ارتفاع کم
    if (fighterJet.position.y < 22) {
      const nx = fighterJet.position.x + Math.sin(fighterJet.rotation.y) * jetSpeed * delta * 2; // پیش‌بینی
      const nz = fighterJet.position.z + Math.cos(fighterJet.rotation.y) * jetSpeed * delta * 2;
      if (_collidesLarge(nx, nz, 3, 3)) {
        jetSpeed *= 0.5;
        _showToast('⚠️ نزدیک ساختمان‌ها ارتفاع بگیر!');
      }
    }
  }

  // ─────────────────────────────────────────────
  // تانک نبرد — زره شیب‌دار، چرخ‌های متحرک، برجک کامل
  // ─────────────────────────────────────────────
  function _buildTank() {
    tank = new THREE.Group();
    tank.userData.wheels = [];

    const hullM   = new THREE.MeshPhongMaterial({ color: 0x4d5c2e, shininess: 30 });
    const hullDk  = new THREE.MeshPhongMaterial({ color: 0x3a4722, shininess: 25 });
    const trackM  = new THREE.MeshPhongMaterial({ color: 0x17181c, shininess: 10 });
    const steelM  = new THREE.MeshPhongMaterial({ color: 0x6b7280, shininess: 110 });
    const wheelM  = new THREE.MeshPhongMaterial({ color: 0x22252b, shininess: 20 });

    // ─── شاسی اصلی ───
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.85, 5.4), hullM);
    hull.position.y = 0.98;
    hull.castShadow = true;
    tank.add(hull);

    // زره شیب‌دار جلو (glacis)
    const glacis = new THREE.Mesh(new THREE.BoxGeometry(3.45, 0.14, 1.9), hullM);
    glacis.position.set(0, 1.22, 2.55);
    glacis.rotation.x = -0.55;
    glacis.castShadow = true;
    tank.add(glacis);

    // زره عقب
    const rearPlate = new THREE.Mesh(new THREE.BoxGeometry(3.45, 0.12, 1.3), hullM);
    rearPlate.position.set(0, 1.05, -2.75);
    rearPlate.rotation.x = 0.35;
    tank.add(rearPlate);

    // جعبه تجهیزات عقب با بندها
    const stowBox = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.95), hullDk);
    stowBox.position.set(-0.6, 1.62, -2.15);
    stowBox.castShadow = true;
    tank.add(stowBox);
    [0, 1].forEach(i => {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.06, 0.08), trackM);
      strap.position.set(-0.6, 1.62, -2.42 + i * 0.5);
      tank.add(strap);
    });

    // ریل‌های جانبی (side skirts)
    [-1, 1].forEach(s => {
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 5.2), hullDk);
      skirt.position.set(s * 1.86, 1.18, 0);
      skirt.castShadow = true;
      tank.add(skirt);
    });

    // ─── زنجیرها با انتهای گرد ───
    [-1, 1].forEach(s => {
      const trackMain = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.72, 4.8), trackM);
      trackMain.position.set(s * 1.93, 0.56, 0);
      trackMain.castShadow = true;
      tank.add(trackMain);

      [[2.4], [-2.4]].forEach(([tz]) => {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.55, 14), trackM);
        cap.rotation.z = Math.PI / 2;
        cap.position.set(s * 1.93, 0.56, tz);
        tank.add(cap);
      });

      // چرخ‌های حرکت بیرون‌زده — قابل چرخش
      for (let i = 0; i < 5; i++) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.16, 14), wheelM);
        w.rotation.z = Math.PI / 2;
        w.position.set(s * 2.24, 0.5, -1.9 + i * 0.95);
        w.castShadow = true;
        tank.add(w);
        tank.userData.wheels.push(w);

        // توپی چرخ
        const hubDot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.18, 8), steelM);
        hubDot.rotation.z = Math.PI / 2;
        hubDot.position.copy(w.position);
        tank.add(hubDot);
      }
    });

    // ─── برجک ───
    const turretDome = new THREE.Group();
    turretDome.name = 'turretDome';
    turretDome.position.y = 1.62;

    const tBase = new THREE.Mesh(new THREE.CylinderGeometry(1.28, 1.48, 0.55, 14), hullM);
    tBase.position.y = 0.12;
    tBase.castShadow = true;
    turretDome.add(tBase);

    // پیشانی شیب‌دار برجک
    const wedge = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.55, 1.15), hullM);
    wedge.position.set(0, 0.42, 0.6);
    wedge.rotation.x = 0.16;
    wedge.castShadow = true;
    turretDome.add(wedge);

    // منتل (محل لوله)
    const mantlet = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.46, 0.32), hullDk);
    mantlet.position.set(0, 0.42, 1.22);
    turretDome.add(mantlet);

    // لوله توپ
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.145, 4.4, 12), hullDk);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.44, 3.15);
    barrel.name = 'barrel';
    barrel.castShadow = true;
    turretDome.add(barrel);

    // ترمز دهانه (muzzle brake) دوتکه
    [4.85, 5.1].forEach((bz, i) => {
      const brake = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, i === 0 ? 0.16 : 0.22), steelM);
      brake.position.set(0, 0.44, bz - 1.65);
      turretDome.add(brake);
    });

    // مسلسل هم‌محور
    const coax = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.95, 6), steelM);
    coax.rotation.x = Math.PI / 2;
    coax.position.set(0.42, 0.38, 1.55);
    turretDome.add(coax);

    // گنبد فرمانده + درپوش
    const cupola = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.28, 10), hullM);
    cupola.position.set(-0.35, 0.68, -0.35);
    turretDome.add(cupola);
    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.06, 10), hullDk);
    hatch.position.set(-0.35, 0.84, -0.35);
    hatch.rotation.z = 0.18; // کمی باز
    turretDome.add(hatch);

    // پرژکتورهای دودزا دو طرف
    [-1, 1].forEach(s => {
      for (let i = 0; i < 3; i++) {
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 6), steelM);
        tube.position.set(s * 1.05, 0.3, 0.85 - i * 0.18);
        tube.rotation.z = s * 0.9;
        turretDome.add(tube);
      }
    });

    // آنتن‌ها
    [[-0.9, -0.7, 0.15], [0.85, -0.75, -0.1]].forEach(([ax, az, tilt]) => {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 1.0, 4), darkAntenna());
      ant.position.set(ax, 0.95, az);
      ant.rotation.x = tilt;
      turretDome.add(ant);
    });

    function darkAntenna() { return new THREE.MeshPhongMaterial({ color: 0x111111 }); }

    tank.add(turretDome);

    // برچسب
    const tankLabel = _makeTextSprite('🪖  T  سوار شو', '#fbbf24');
    tankLabel.position.set(0, 4.5, 0);
    tankLabel.scale.set(5, 1.5, 1);
    tankLabel.name = 'tankLabel';
    tank.add(tankLabel);
    labels.push(tankLabel);

    // موقعیت اولیه تانک — کنار جاده اصلی
    tank.position.set(-30, 0, 15);
    tank.rotation.y = Math.PI / 6;
    scene.add(tank);
  }

  function _updateTank(delta) {
    if (!tank || !inTank) return;
    const forward = keys.w || keys.ArrowUp;
    const backward = keys.s || keys.ArrowDown;
    const turnLeft = keys.a || keys.ArrowLeft;
    const turnRight = keys.d || keys.ArrowRight;

    if (forward)  tankVelocity = Math.min(tankVelocity + 12 * delta, TANK_SPEED);
    else if (backward) tankVelocity = Math.max(tankVelocity - 12 * delta, -TANK_SPEED * 0.4);
    else { tankVelocity *= (1 - 4 * delta); if (Math.abs(tankVelocity) < 0.05) tankVelocity = 0; }

    if (Math.abs(tankVelocity) > 0.1) {
      const dir = tankVelocity > 0 ? 1 : -1;
      if (turnLeft)  tank.rotation.y += TANK_TURN_SPEED * delta * dir;
      if (turnRight) tank.rotation.y -= TANK_TURN_SPEED * delta * dir;
    }

    if (Math.abs(tankVelocity) > 0.01) {
      const nx = tank.position.x + Math.sin(tank.rotation.y) * tankVelocity * delta;
      const nz = tank.position.z + Math.cos(tank.rotation.y) * tankVelocity * delta;
      if (!_collidesLarge(nx, nz, 3, 3.5)) {
        tank.position.x = nx; tank.position.z = nz;
      } else { tankVelocity *= -0.3; }
      tank.position.x = Math.max(-WORLD_EDGE, Math.min(WORLD_EDGE, tank.position.x));
      tank.position.z = Math.max(-WORLD_EDGE, Math.min(WORLD_EDGE, tank.position.z));

      // چرخش چرخ‌های حرکت با سرعت واقعی
      const tw = tank.userData.wheels || [];
      const spin = (tankVelocity > 0 ? -1 : 1) * Math.abs(tankVelocity) * delta * 2.6;
      tw.forEach(w => { w.rotation.x += spin; });
    }

    // برجک تانک همیشه نرم دنبال جهت دوربین
    if (inTank && tank) {
      const dome = tank.getObjectByName('turretDome');
      if (dome) {
        const desired = camera.rotation.y - tank.rotation.y;
        dome.rotation.y += (desired - dome.rotation.y) * Math.min(1, delta * 5);
      }
    }
  }

  function _mountTank() {
    inTank = true;
    tankVelocity = 0;
    character.visible = false;
    const lbl = tank.getObjectByName('tankLabel');
    if (lbl) lbl.visible = false;
    _showToast('🪖 داخل تانک — WASD حرکت، چپ‌کلیک شلیک، راست‌کلیک نشانه‌گیری، T پیاده');
    const hint = document.getElementById('city-controls-hint');
    if (hint) hint.innerHTML = `
      <p><span class="key">W</span><span class="key">S</span> — گاز / ترمز</p>
      <p><span class="key">A</span><span class="key">D</span> — فرمان</p>
      <p><span class="key">چپ‌کلیک</span> — شلیک توپ انفجاری</p>
      <p><span class="key">راست‌کلیک</span> (نگه دار) — نشانه‌گیری + زوم</p>
      <p><span class="key">T</span> — پیاده شدن</p>`;
  }

  function _unmountTank() {
    inTank = false; tankVelocity = 0;
    character.visible = true;
    character.position.set(tank.position.x + 3, 0, tank.position.z + 3);
    character.rotation.y = tank.rotation.y;
    const lbl = tank.getObjectByName('tankLabel');
    if (lbl) lbl.visible = true;
    _showToast('🚶 از تانک پیاده شدید');
  }

  // ─────────────────────────────────────────────
  // سیستم اسلحه MP4 (شلیک با موس)
  // ─────────────────────────────────────────────
  function _buildWeaponSystem() {
    // اسلحه که به دوربین متصله
    weapon = new THREE.Group();
    weapon.name = 'weapon';

    // بدنه اسلحه
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.14, 0.65),
      new THREE.MeshPhongMaterial({ color: 0x1a1a1a, shininess: 60 })
    );
    weapon.add(body);

    // لوله
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.03, 0.55, 6),
      new THREE.MeshPhongMaterial({ color: 0x0d0d0d })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, 0.55);
    barrel.name = 'gunBarrel';
    weapon.add(barrel);

    // دسته
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.22, 0.09),
      new THREE.MeshPhongMaterial({ color: 0x2a1a0a })
    );
    grip.position.set(0, -0.16, 0.05);
    weapon.add(grip);

    // خشاب
    const mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.18, 0.09),
      new THREE.MeshPhongMaterial({ color: 0x111 })
    );
    mag.position.set(0, -0.13, 0.12);
    weapon.add(mag);

    // دوربین نشانه
    const scope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.22, 6),
      new THREE.MeshPhongMaterial({ color: 0x333 })
    );
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.1, 0.2);
    weapon.add(scope);

    // فلاش مازل
    muzzleFlash = new THREE.PointLight(0xffaa00, 0, 2);
    muzzleFlash.position.set(0, 0.02, 0.85);
    muzzleFlash.name = 'muzzleFlash';
    weapon.add(muzzleFlash);

    // موقعیت نسبت به دوربین (پایین-راست)
    weapon.position.set(0.35, -0.28, -0.6);
    weapon.rotation.y = -0.05;
    weapon.visible = false; // فقط داخل تانک/هلی فعال می‌شه
    camera.add(weapon);

    // پیش‌نماش (crosshair) در HUD
    _buildCrosshair();
  }

  function _buildCrosshair() {
    // اگر از HTML از پیش موجوده، دوباره نساز
    if (document.getElementById('city-crosshair')) return;
    const ch = document.createElement('div');
    ch.id = 'city-crosshair';
    ch.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      width:24px;height:24px;pointer-events:none;z-index:600;`;
    ch.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" stroke="#fff" stroke-width="1.5" fill="none" opacity="0.9"/>
      <line x1="12" y1="2" x2="12" y2="8" stroke="#fff" stroke-width="1.5" opacity="0.9"/>
      <line x1="12" y1="16" x2="12" y2="22" stroke="#fff" stroke-width="1.5" opacity="0.9"/>
      <line x1="2" y1="12" x2="8" y2="12" stroke="#fff" stroke-width="1.5" opacity="0.9"/>
      <line x1="16" y1="12" x2="22" y2="12" stroke="#fff" stroke-width="1.5" opacity="0.9"/>
    </svg>`;
    ch.style.display = 'none'; // فقط داخل تانک/هلی
    document.body.appendChild(ch);

    // HUD آمار تیراندازی — فقط اگه موجود نیست
    if (document.getElementById('city-weapon-stats')) return;
    const statsDiv = document.createElement('div');
    statsDiv.id = 'city-weapon-stats';
    statsDiv.style.cssText = `
      position:fixed;bottom:14px;left:50%;transform:translateX(-50%);
      background:rgba(0,0,0,0.6);color:#fff;font-size:0.75rem;
      padding:6px 16px;border-radius:8px;z-index:500;pointer-events:none;
      font-family:Vazirmatn,Tahoma,sans-serif;border:1px solid rgba(255,255,255,0.1);`;
    statsDiv.innerHTML = `🔫 <span id="city-ammo">∞</span>  💀 <span id="city-kills">0</span>  🎯 <span id="city-shots">0</span>`;
    statsDiv.style.display = 'none';
    document.body.appendChild(statsDiv);
  }

  // ─────────────────────────────────────────────
  // استخر گلوله
  // ─────────────────────────────────────────────
  function _buildBulletPool() {
    const bulletGeo = new THREE.SphereGeometry(0.06, 6, 6);
    const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffee00 });
    for (let i = 0; i < 40; i++) {
      const b = new THREE.Mesh(bulletGeo, bulletMat);
      b.visible = false;
      b.userData = { active: false, velocity: new THREE.Vector3(), life: 0, isExplosive: false };
      scene.add(b);
      bulletPool.push(b);
    }
  }

  function _getFreeBullet() {
    return bulletPool.find(b => !b.userData.active) || null;
  }

  function _shoot(isExplosive) {
    const now = Date.now();
    if (now - lastShootTime < SHOOT_COOLDOWN) return;
    // فقط داخل تانک، هلی‌کوپتر یا جنگنده قابل شلیک
    if (!inTank && !inHeli && !inJet) return;
    lastShootTime = now;
    shotsFired++;
    const el = document.getElementById('city-shots');
    if (el) el.textContent = shotsFired;

    const bullet = _getFreeBullet();
    if (!bullet) return;

    // جهت از مرکز صفحه (کراسهیر)
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const dir = raycaster.ray.direction.clone().normalize();

    // موقعیت شروع بر اساس وسیله
    let origin;
    if (inTank && tank) {
      const barrel = tank.getObjectByName('barrel');
      origin = barrel
        ? barrel.getWorldPosition(new THREE.Vector3())
        : tank.position.clone().add(new THREE.Vector3(0, 2.2, 0));
      origin.add(dir.clone().multiplyScalar(3)); // کمی جلوتر از دهانه
    } else if (inHeli && helicopter) {
      origin = helicopter.position.clone().add(new THREE.Vector3(0, -1.4, 0));
      origin.add(dir.clone().multiplyScalar(2.5));
    } else if (inJet && fighterJet) {
      // از توپ‌های دماغه جنگنده
      const nose = new THREE.Vector3(Math.sin(fighterJet.rotation.y) * 5, 0.9, Math.cos(fighterJet.rotation.y) * 5);
      origin = fighterJet.position.clone().add(nose);
    } else {
      return;
    }

    bullet.position.copy(origin);
    bullet.userData.velocity = dir.clone().multiplyScalar(inJet ? BULLET_SPEED * 1.6 : BULLET_SPEED);
    bullet.userData.life = BULLET_LIFE;
    bullet.userData.active = true;
    bullet.userData.isExplosive = !!isExplosive;
    bullet.visible = true;
    bullets.push(bullet);

    // فلاش مازل
    if (muzzleFlash) {
      muzzleFlash.intensity = isExplosive ? 7 : 4;
      setTimeout(() => { if (muzzleFlash) muzzleFlash.intensity = 0; }, 60);
    }

    // لگد (recoil) اسلحه
    if (weapon) {
      weapon.position.z += 0.04;
      setTimeout(() => { if (weapon) weapon.position.z -= 0.04; }, 80);
    }
  }

  function _updateBullets(delta) {
    bullets.forEach((b, idx) => {
      if (!b.userData.active) return;
      b.userData.life -= delta;
      if (b.userData.life <= 0) {
        _deactivateBullet(b);
        return;
      }
      // حرکت گلوله — گرانش گلوله معمولی ملایم، توپ تانک بیشتر
      b.userData.velocity.y += (b.userData.isExplosive ? -12 : -4) * delta;
      b.position.x += b.userData.velocity.x * delta;
      b.position.y += b.userData.velocity.y * delta;
      b.position.z += b.userData.velocity.z * delta;

      // برخورد دقیق با NPC — کپسول بدن (بدون اصابت فانتزی از پشت/کنار)
      npcs.forEach(npc => {
        if (!npc.visible || npc.userData.state === 'dead') return;
        const dx = npc.position.x - b.position.x;
        const dz = npc.position.z - b.position.z;
        const hDist = Math.sqrt(dx * dx + dz * dz);
        if (hDist < 0.55 && b.position.y > 0.05 && b.position.y < 2.3) {
          const headshot = hDist < 0.32 && b.position.y > 1.62;
          _hitNPC(npc, headshot);
          if (b.userData.isExplosive) _explode(b.position.clone());
          _deactivateBullet(b);
        }
      });

      // برخورد با زمین
      if (b.position.y < 0) {
        if (b.userData.isExplosive) _explode(b.position.clone());
        _deactivateBullet(b);
      }
    });
    // پاکسازی bullets غیرفعال
    bullets = bullets.filter(b => b.userData.active);
  }

  function _deactivateBullet(b) {
    b.userData.active = false;
    b.visible = false;
  }

  function _hitNPC(npc, headshot) {
    kills++;
    const el = document.getElementById('city-kills');
    if (el) el.textContent = kills;
    _showToast(headshot ? '🎯 شات به سر! هدف از پا درآمد' : '💥 هدف اصابت شد!');
    // NPC زمین می‌خوره
    npc.rotation.x = -Math.PI / 2;
    npc.position.y = 0;
    const ud = npc.userData;
    ud.state = 'dead';
    // بعد ۳ ثانیه دوباره بلند می‌شه
    setTimeout(() => {
      npc.rotation.x = 0;
      npc.position.y = 0;
      _resetPose(npc);
      ud.state = 'walk';
      ud.path = [];
    }, 3000);
    // افکت دود
    _spawnSmoke(npc.position.clone());
  }

  function _explode(pos) {
    // نور انفجار
    const boom = new THREE.PointLight(0xff6600, 8, 12);
    boom.position.copy(pos);
    scene.add(boom);
    _showToast('💣 انفجار!');
    setTimeout(() => scene.remove(boom), 300);
    // دود
    for (let i = 0; i < 5; i++) {
      const sp = pos.clone().add(new THREE.Vector3((Math.random()-0.5)*2, Math.random()*2, (Math.random()-0.5)*2));
      _spawnSmoke(sp);
    }
  }

  // ذرات دود ساده
  const smokeParticles = [];
  function _spawnSmoke(pos) {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.4 + Math.random() * 0.4, 5, 5),
      new THREE.MeshBasicMaterial({ color: 0x555, transparent: true, opacity: 0.7 })
    );
    s.position.copy(pos);
    s.userData = { life: 1.5, vy: 1.5 + Math.random() };
    scene.add(s);
    smokeParticles.push(s);
  }

  function _updateSmoke(delta) {
    smokeParticles.forEach((s, i) => {
      s.userData.life -= delta;
      s.position.y += s.userData.vy * delta;
      s.material.opacity = Math.max(0, s.userData.life / 1.5 * 0.7);
      s.scale.setScalar(1 + (1.5 - s.userData.life) * 1.5);
      if (s.userData.life <= 0) {
        scene.remove(s);
        smokeParticles.splice(i, 1);
      }
    });
  }

  // ─────────────────────────────────────────────
  // API عمومی
  // ─────────────────────────────────────────────
  function destroy() {
    _running = false;
    // حذف همه listenerها
    _listeners.forEach(([t, ev, fn]) => { try { t.removeEventListener(ev, fn); } catch (e) {} });
    _listeners.length = 0;
    if (document.exitPointerLock && document.pointerLockElement) {
      try { document.exitPointerLock(); } catch (e) {}
    }
    // پاکسازی DOM های ساخته‌شده
    ['city-crosshair', 'city-weapon-stats'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    if (renderer) {
      renderer.dispose();
      const el = renderer.domElement;
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
    scene = null; camera = null; renderer = null;
    character = null; carMesh = null; tank = null; helicopter = null;
    weapon = null; muzzleFlash = null; fountainRef = null;
    buildings = []; labels = []; npcs = [];
    bullets = []; bulletPool = [];
    smokeParticles.length = 0;
    birdFlocks.length = 0;
    staticColliders.length = 0;
    trafficCars.length = 0;
    pedestrians.length = 0;
    barrels.length = 0;
    policeStations.length = 0;
    dog = null; football = null; _policeFlagRef = null; _skyscraperBeacons = null;
    nearBuilding = null; nearCar = false; nearTank = false; nearHeli = false;
    nearJet = false; nearNPC = null;
    inCar = inTank = inHeli = inJet = false;
    dialogOpen = false;
    heliState = 'patrol'; rotorSpeed = 0;
    jetState = 'parked'; jetSpeed = 0;
    fighterJet = null;
    vertVel = 0;
    _closeDialog();
    const dlgEl = document.getElementById('city-npc-dialog');
    if (dlgEl && dlgEl.parentNode) dlgEl.parentNode.removeChild(dlgEl);
  }

  return { init, destroy };

})();
