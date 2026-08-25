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
  const MINIMAP_SCALE = 0.022;

  // ─── NPC ───
  let npcs = [];
  const NPC_CONFIGS = [
    { name: 'سارا', role: 'employee', color: 0xff69b4, headColor: 0xffd700, speed: 3.5 },
    { name: 'زینب', role: 'employee', color: 0x9370db, headColor: 0xffd700, speed: 3.0 },
    { name: 'فرزاد', role: 'employee', color: 0x20b2aa, headColor: 0xffa07a, speed: 4.0 },
    { name: 'فاضلی', role: 'employee', color: 0xff8c00, headColor: 0xffa07a, speed: 3.2 },
    { name: 'دکتر', role: 'employee', color: 0x32cd32, headColor: 0xffd700, speed: 3.8 },
    { name: 'معصومی', role: 'agent', color: 0x4169e1, headColor: 0xffa07a, speed: 5.0 },
    { name: '-صادقی', role: 'agent', color: 0x8b0000, headColor: 0xffd700, speed: 4.5 },
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

  // ─── چرخه شب و روز + محیط ───
  let dayTime = 0.25;
  const DAY_LENGTH = 420; // چرخه کامل — روز حدود ۶۲٪ و شب حدود ۳۸٪
  let sunLight = null, ambientLight = null, fountainRef = null, windowMat = null;
  const SKY_DAY = new THREE.Color(0x87ceeb);
  const SKY_NIGHT = new THREE.Color(0x0b1026);
  const FOG_DAY = new THREE.Color(0xa5d3ef);
  const FOG_NIGHT = new THREE.Color(0x131c36);
  const lampLights = [];
  const birdFlocks = [];

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
  function _addCollider(x, z, hw, hd) {
    staticColliders.push({ x, z, hw, hd });
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
    scene.fog = new THREE.Fog(0x87ceeb, 80, 280);

    clock = new THREE.Clock();

    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 400);
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

    // رویدادها
    _bindEvents(container);

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

    console.log('✅ CityWorld initialized');
  }

  // ─────────────────────────────────────────────
  // نور
  // ─────────────────────────────────────────────
  function _buildLights() {
    // نور محیطی ملایم
    ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

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
    sunLight = sun;
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
    // زمین اصلی ۴۰۰×۴۰۰
    const geo = new THREE.PlaneGeometry(400, 400, 60, 60);
    const mat = new THREE.MeshLambertMaterial({ color: 0x4ade80 });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // درخت‌های پراکنده — تعداد بیشتر برای شهر بزرگ‌تر
    for (let i = 0; i < 180; i++) {
      const gx = (Math.random() - 0.5) * 360;
      const gz = (Math.random() - 0.5) * 360;
      const tooClose = BUILDINGS_CONFIG.some(b => {
        const dx = gx - b.position.x, dz = gz - b.position.z;
        return Math.sqrt(dx*dx + dz*dz) < 10;
      });
      if (tooClose) continue;
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

    // جاده‌های اصلی (پهن‌تر)
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
    ];

    roads.forEach(r => {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.h), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(r.x, roadY, r.z);
      scene.add(road);
    });

    // خط‌کشی جاده اصلی (بلندتر)
    for (let i = -105; i < 110; i += 7) {
      const s1 = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 3.5), stripeMat);
      s1.rotation.x = -Math.PI / 2;
      s1.position.set(i, roadY + 0.01, 0);
      scene.add(s1);
      const s2 = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 0.25), stripeMat);
      s2.rotation.x = -Math.PI / 2;
      s2.position.set(0, roadY + 0.01, i);
      scene.add(s2);
    }

    // چراغ‌های خیابان
    const poleM = new THREE.MeshLambertMaterial({ color: 0x555 });
    const lightM = new THREE.MeshBasicMaterial({ color: 0xffffaa });
    for (let i = -100; i <= 100; i += 25) {
      [[i, 5], [i, -5]].forEach(([x, z]) => {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 6, 6), poleM);
        pole.position.set(x, 3, z);
        scene.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), lightM);
        lamp.position.set(x, 6.3, z);
        scene.add(lamp);
        const pl = new THREE.PointLight(0xffffee, 0, 20);
        pl.position.set(x, 6, z);
        scene.add(pl);
        lampLights.push(pl);
      });
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
        windowMat = winMat;
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
  // ساخت ماشین
  // ─────────────────────────────────────────────
  function _buildCar() {
    carMesh = new THREE.Group();

    // بدنه اصلی (پایین)
    const bodyLow = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.7, 4.5),
      new THREE.MeshPhongMaterial({ color: 0xe53e3e, shininess: 80 })
    );
    bodyLow.position.y = 0.65;
    bodyLow.castShadow = true;
    carMesh.add(bodyLow);

    // بدنه بالا (کابین)
    const bodyTop = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.6, 2.4),
      new THREE.MeshPhongMaterial({ color: 0xc53030, shininess: 60 })
    );
    bodyTop.position.set(0, 1.25, -0.1);
    bodyTop.castShadow = true;
    carMesh.add(bodyTop);

    // شیشه جلو
    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.55, 0.08),
      new THREE.MeshPhongMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.55, shininess: 120 })
    );
    windshield.position.set(0, 1.22, 1.12);
    windshield.rotation.x = 0.35;
    carMesh.add(windshield);

    // شیشه عقب
    const rearGlass = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.5, 0.08),
      new THREE.MeshPhongMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.45, shininess: 120 })
    );
    rearGlass.position.set(0, 1.22, -1.32);
    rearGlass.rotation.x = -0.35;
    carMesh.add(rearGlass);

    // چرخ‌ها (4 تا)
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 14);
    const wheelMat = new THREE.MeshPhongMaterial({ color: 0x1a1a1a, shininess: 20 });
    const rimMat  = new THREE.MeshPhongMaterial({ color: 0xd1d5db, shininess: 80 });

    const wheelPos = [
      { x:  1.2, z:  1.5 },  // جلو-راست
      { x: -1.2, z:  1.5 },  // جلو-چپ
      { x:  1.2, z: -1.5 },  // عقب-راست
      { x: -1.2, z: -1.5 },  // عقب-چپ
    ];
    wheelPos.forEach(wp => {
      const wheelGroup = new THREE.Group();

      const tire = new THREE.Mesh(wheelGeo, wheelMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wheelGroup.add(tire);

      // رینگ
      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.3, 8),
        rimMat
      );
      rim.rotation.z = Math.PI / 2;
      wheelGroup.add(rim);

      wheelGroup.position.set(wp.x, 0.38, wp.z);
      carMesh.add(wheelGroup);
    });

    // چراغ جلو (زرد)
    const headlightMat = new THREE.MeshPhongMaterial({ color: 0xfef08a, emissive: 0xfde047, emissiveIntensity: 0.6 });
    [-0.65, 0.65].forEach(xOff => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.08), headlightMat);
      hl.position.set(xOff, 0.72, 2.3);
      carMesh.add(hl);
    });

    // چراغ عقب (قرمز)
    const taillightMat = new THREE.MeshPhongMaterial({ color: 0xfca5a5, emissive: 0xef4444, emissiveIntensity: 0.5 });
    [-0.65, 0.65].forEach(xOff => {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.08), taillightMat);
      tl.position.set(xOff, 0.72, -2.31);
      carMesh.add(tl);
    });

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
  // محیط پویا — چرخه شب/روز، پرنده‌ها، فواره
  // ─────────────────────────────────────────────
  function _updateEnvironment(delta) {
    dayTime = (dayTime + delta / DAY_LENGTH) % 1;
    const sunElev = Math.sin(dayTime * Math.PI * 2);   // ارتفاع خورشید
    // روز طولانی‌تر: آستانه پایین‌تر یعنی خورشید دیرتر غروب و زودتر طلوع می‌کنه
    const daylight = Math.min(1, Math.max(0, (sunElev + 0.35) / 1.25));
    const dusk = Math.max(0, 1 - Math.abs(sunElev) * 3.2); // طلوع/غروب طلایی

    if (sunLight) {
      sunLight.intensity = 0.12 + daylight * 1.15;
      sunLight.color.setRGB(1, 0.96 - dusk * 0.18, 0.88 - dusk * 0.4);
      sunLight.position.set(
        Math.cos(dayTime * Math.PI * 2) * 140,
        Math.max(10, sunElev * 140),
        -60
      );
    }
    if (ambientLight) ambientLight.intensity = 0.15 + daylight * 0.38;

    if (scene.background && scene.background.isColor) {
      scene.background.copy(SKY_NIGHT).lerp(SKY_DAY, daylight);
    }
    if (scene.fog && scene.fog.color) {
      scene.fog.color.copy(FOG_NIGHT).lerp(FOG_DAY, daylight);
    }

    // چراغ خیابان و پنجره‌ها شب روشن می‌شن
    const night = 1 - daylight;
    for (const l of lampLights) l.intensity = night * 0.7;
    if (windowMat) windowMat.emissiveIntensity = 0.15 + night * 0.9;

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
    if (fountainRef) {
      const jet = fountainRef.getObjectByName('jet');
      if (jet) {
        const p = 1 + Math.sin(now * 6) * 0.08;
        jet.scale.set(p, 1 + Math.sin(now * 9) * 0.1, p);
      }
      const water = fountainRef.getObjectByName('water');
      if (water) water.position.y = 0.72 + Math.sin(now * 2) * 0.02;
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
      if (e.key === 'Enter' && nearBuilding && !inCar && !inTank && !inHeli) {
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
      // شلیک فقط داخل تانک یا هلی‌کوپتر
      if (!inTank && !inHeli) {
        _showToast('🔒 برای شلیک باید داخل تانک یا هلی‌کوپتر باشید');
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
        const target = inHeli ? helicopter : inTank ? tank : carMesh;
        if (target) target.rotation.y -= e.movementX * sens;
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
      <p><span class="key">Space</span> — پرش · <span class="key">Enter</span> — ورود به ساختمان</p>
      <p><span class="key">F</span> ماشین · <span class="key">T</span> تانک · <span class="key">H</span> هلی‌کوپتر (کنار پد)</p>
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

    // هلی‌کوپتر
    _updateHelicopter(delta);

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
    if (inHeli)      _updateHelicopterFlight(delta);
    else if (inTank) _updateTank(delta);
    else if (inCar)  _updateCarMovement(delta);
    else             _updateCharacterMovement(delta);
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
      carMesh.position.x = Math.max(-185, Math.min(185, carMesh.position.x));
      carMesh.position.z = Math.max(-185, Math.min(185, carMesh.position.z));

      // انیمیشن چرخش چرخ‌ها
      const wheelTurn = carVelocity * delta * 2.5;
      carMesh.children.forEach((child, idx) => {
        // ایندکس‌های ۲ تا ۵ = چرخ‌ها
        if (idx >= 2 && idx <= 5 && child.children.length > 0) {
          child.children[0].rotation.x += wheelTurn;
        }
      });
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

      character.position.x = Math.max(-185, Math.min(185, character.position.x));
      character.position.z = Math.max(-185, Math.min(185, character.position.z));

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

    } else {
      // ─── داخل ماشین یا تانک: فقط ریست ساختمان‌ها و نزدیکی ───
      nearBuilding = null;
      nearCar = false;
      nearTank = false;
      nearHeli = false;
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
    if (inHeli && helicopter) {
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

    // ─── زوم نشانه‌گیری (FOV) ───
    const targetFov = (isAiming && (inTank || inHeli)) ? 42 : 60;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, 0.18);
      camera.updateProjectionMatrix();
    }
  }

  // HUD حالت رزم — اسلحه/کراسهیر فقط داخل تانک یا هلی
  function _updateCombatHUD() {
    const combat = !!(inTank || inHeli);
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

    // ─── جت جنگنده ───
    const jet = _makeFighterJet();
    jet.position.set(-23, 0, 22);
    jet.rotation.y = Math.PI / 2; // دماغه رو به تاکسی‌وی
    g.add(jet);

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

    // برخورد با بدنه جت
    _addCollider(128 - 23, 22, 3.2, 6);
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
  // Minimap 2D
  // ─────────────────────────────────────────────
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
      const npc = _makeCharacterMesh(cfg.color);
      // تنوع قد — مثل آدم‌های واقعی
      npc.scale.setScalar(0.93 + Math.random() * 0.15);

      npc.userData = {
        name: cfg.name,
        role: cfg.role,
        speed: cfg.speed,
        state: 'walk',       // walk | enter | inside | exit
        target: null,        // ساختمان مقصد
        insideTimer: 0,
        waitTimer: 0,
        angle: (idx / NPC_CONFIGS.length) * Math.PI * 2,
        phase: Math.random() * Math.PI * 2, // فاز گام هر NPC
        // مسیر NPC
        path: [],
        pathIdx: 0,
      };

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
  }

  // ساخت انسان واقع‌گرایانه — اسکلت کامل با تنوع ظاهری
  function _makeCharacterMesh(shirtColor) {
    const SKIN_TONES = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
    const HAIR_COLORS = [0x1b1512, 0x2b1d16, 0x4a3120, 0x111116, 0x5a4632];
    const PANT_COLORS = [0x1e293b, 0x334155, 0x3f3f46, 0x27272a];
    const skin = SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)];
    const hairC = HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)];
    const pantC = PANT_COLORS[Math.floor(Math.random() * PANT_COLORS.length)];

    const group = new THREE.Group();
    const all = [];

    // ─── لگن (ریز حرکت) ───
    const hips = new THREE.Group();
    hips.position.y = 0.92;
    group.add(hips);

    const pelvis = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.18, 0.22),
      new THREE.MeshPhongMaterial({ color: pantC })
    );
    pelvis.castShadow = true;
    hips.add(pelvis);

    // ─── تنه — کمر باریک، شانه پهن ───
    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.19, 0.6, 10),
      new THREE.MeshPhongMaterial({ color: shirtColor })
    );
    torso.position.y = 0.4;
    torso.castShadow = true;
    torso.name = 'torsoMesh';
    hips.add(torso);
    const chest = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.24, 0.27),
      new THREE.MeshPhongMaterial({ color: shirtColor })
    );
    chest.position.y = 0.66;
    chest.castShadow = true;
    hips.add(chest);

    // ─── گردن و سر ───
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.075, 0.12, 8),
      new THREE.MeshPhongMaterial({ color: skin })
    );
    neck.position.y = 0.8;
    hips.add(neck);

    const headGrp = new THREE.Group();
    headGrp.position.y = 0.95;
    hips.add(headGrp);

    const skull = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 14, 14),
      new THREE.MeshPhongMaterial({ color: skin })
    );
    skull.scale.set(0.92, 1.05, 0.98);
    skull.castShadow = true;
    headGrp.add(skull);

    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.168, 14, 8, 0, Math.PI * 2, 0, Math.PI / 1.85),
      new THREE.MeshPhongMaterial({ color: hairC })
    );
    hair.position.y = 0.01;
    headGrp.add(hair);

    const eyeM = new THREE.MeshBasicMaterial({ color: 0x14141c });
    [-0.058, 0.058].forEach(ex => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.021, 6, 6), eyeM);
      eye.position.set(ex, 0.02, 0.135);
      headGrp.add(eye);
    });

    // ─── پاها: ران → زانو → ساق + کفش ───
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
        new THREE.BoxGeometry(0.13, 0.08, 0.25),
        new THREE.MeshPhongMaterial({ color: 0x18181b })
      );
      shoe.position.set(0, -0.42, 0.05);
      shoe.castShadow = true;
      knee.add(shoe);

      legs.push(hip); knees.push(knee); all.push(hip, knee);
    });

    // ─── دست‌ها: شانه → آرنج → ساعد + دست ───
    const arms = [], elbows = [];
    [-0.29, 0.29].forEach(x => {
      const sh = new THREE.Group();
      sh.position.set(x, 0.64, 0);
      sh.rotation.z = x > 0 ? -0.09 : 0.09;
      hips.add(sh);

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

      const hand = new THREE.Mesh(
        new THREE.SphereGeometry(0.052, 8, 8),
        new THREE.MeshPhongMaterial({ color: skin })
      );
      hand.position.y = -0.32;
      el.add(hand);

      arms.push(sh); elbows.push(el); all.push(sh, el);
    });

    // تورسو برای خم شدن — پیوت جدا لازم نیست؛ خود mesh حول مرکزش کمی می‌خوره
    group.userData.limbs = { legs, knees, arms, elbows, all, headGrp, torso };
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

    // خم شدن ملایم تنه به جلو + تکون سر
    if (L.torso) L.torso.rotation.x = 0.05 + amp * 0.06;
    if (L.headGrp) L.headGrp.rotation.y = Math.sin(phase * 0.5) * 0.06;

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
        return;
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

  // انیمیشن NPC — گام واقعی با فاز مستقل
  function _animateNPC(npc, delta) {
    const ud = npc.userData;
    ud.phase += delta * (ud.speed * 2.2 + 3);
    _animHumanoid(npc, ud.phase, 0.5);
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
  // هلی‌کوپتر
  // ─────────────────────────────────────────────
  function _buildHelicopter() {
    helicopter = new THREE.Group();

    // بدنه اصلی
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 1.2, 5),
      new THREE.MeshPhongMaterial({ color: 0x2d4a1e, shininess: 60 })
    );
    body.castShadow = true;
    helicopter.add(body);

    // کابین (شیشه)
    const cockpit = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshPhongMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.6, shininess: 150 })
    );
    cockpit.position.set(0, 0.2, 1.8);
    helicopter.add(cockpit);

    // دُم
    const tail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.1, 4.5, 6),
      new THREE.MeshPhongMaterial({ color: 0x2d4a1e })
    );
    tail.rotation.x = Math.PI / 2;
    tail.position.set(0, 0.1, -3.8);
    helicopter.add(tail);

    // روتور اصلی (group برای چرخش)
    const mainRotorGroup = new THREE.Group();
    mainRotorGroup.name = 'mainRotor';
    mainRotorGroup.position.set(0, 0.85, 0);
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(5.5, 0.08, 0.35),
        new THREE.MeshPhongMaterial({ color: 0x1a1a2e })
      );
      blade.rotation.y = (i / 4) * Math.PI * 2;
      blade.castShadow = true;
      mainRotorGroup.add(blade);
    }
    helicopter.add(mainRotorGroup);

    // روتور دُم
    const tailRotorGroup = new THREE.Group();
    tailRotorGroup.name = 'tailRotor';
    tailRotorGroup.position.set(0.45, 0.3, -5.8);
    for (let i = 0; i < 2; i++) {
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 1.2, 0.18),
        new THREE.MeshPhongMaterial({ color: 0x1a1a2e })
      );
      blade.rotation.x = (i / 2) * Math.PI;
      tailRotorGroup.add(blade);
    }
    helicopter.add(tailRotorGroup);

    // پایه‌های فرود
    [[-0.9, 0.9]].forEach(([z1, z2]) => {
      [-1, 1].forEach(x => {
        const skid = new THREE.Mesh(
          new THREE.CylinderGeometry(0.07, 0.07, 2.2, 6),
          new THREE.MeshPhongMaterial({ color: 0x333 })
        );
        skid.rotation.z = Math.PI / 2;
        skid.position.set(x * 1.1, -0.7, (z1 + z2) / 2);
        helicopter.add(skid);
      });
    });

    // نور چشمک‌زن
    const heliLight = new THREE.PointLight(0xff0000, 1.5, 8);
    heliLight.name = 'heliLight';
    heliLight.position.set(0, -0.5, 2.5);
    helicopter.add(heliLight);

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

    // چشمک نور
    const hl = helicopter.getObjectByName('heliLight');
    if (hl) hl.intensity = (rotorSpeed > 2 && Math.sin(Date.now() * 0.01) > 0) ? 2 : 0;

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
    helicopter.position.x = Math.max(-185, Math.min(185, helicopter.position.x));
    helicopter.position.z = Math.max(-185, Math.min(185, helicopter.position.z));
  }

  // ─────────────────────────────────────────────
  // تانک
  // ─────────────────────────────────────────────
  function _buildTank() {
    tank = new THREE.Group();

    // بدنه اصلی
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 1.0, 5.5),
      new THREE.MeshPhongMaterial({ color: 0x556b2f, shininess: 20 })
    );
    hull.position.y = 0.8;
    hull.castShadow = true;
    tank.add(hull);

    // برج (turret)
    const turretBase = new THREE.Mesh(
      new THREE.CylinderGeometry(1.3, 1.5, 0.7, 8),
      new THREE.MeshPhongMaterial({ color: 0x4a5e2a })
    );
    turretBase.position.y = 1.65;
    turretBase.castShadow = true;
    tank.add(turretBase);

    // گنبد برج
    const turretDome = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.65, 2.8),
      new THREE.MeshPhongMaterial({ color: 0x4a5e2a })
    );
    turretDome.position.y = 2.15;
    turretDome.name = 'turretDome';
    tank.add(turretDome);

    // لوله توپ
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.15, 4.5, 8),
      new THREE.MeshPhongMaterial({ color: 0x2d3a18 })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, 2.5);
    barrel.name = 'barrel';
    turretDome.add(barrel);

    // چرخ‌ها و زنجیر
    const trackMat = new THREE.MeshPhongMaterial({ color: 0x1a1a1a });
    const wheelMat = new THREE.MeshPhongMaterial({ color: 0x333 });
    [-1.9, 1.9].forEach(x => {
      // زنجیر (track)
      const track = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.7, 5.5),
        trackMat
      );
      track.position.set(x, 0.45, 0);
      track.castShadow = true;
      tank.add(track);
      // چرخ‌ها (۴ تا هر طرف)
      for (let i = -2; i <= 2; i++) {
        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10),
          wheelMat
        );
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.42, i * 1.2);
        tank.add(wheel);
      }
    });

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
      tank.position.x = Math.max(-185, Math.min(185, tank.position.x));
      tank.position.z = Math.max(-185, Math.min(185, tank.position.z));
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
    // فقط داخل تانک یا هلی‌کوپتر قابل شلیک
    if (!inTank && !inHeli) return;
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
    } else {
      return;
    }

    bullet.position.copy(origin);
    bullet.userData.velocity = dir.multiplyScalar(BULLET_SPEED);
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
    weapon = null; muzzleFlash = null; fountainRef = null; sunLight = null; ambientLight = null; windowMat = null;
    buildings = []; labels = []; npcs = [];
    bullets = []; bulletPool = [];
    smokeParticles.length = 0;
    birdFlocks.length = 0; lampLights.length = 0;
    staticColliders.length = 0;
    nearBuilding = null; nearCar = false; nearTank = false; nearHeli = false;
    inCar = inTank = inHeli = false;
    heliState = 'patrol'; rotorSpeed = 0;
    vertVel = 0;
  }

  return { init, destroy };

})();
