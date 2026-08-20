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
  const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false, f: false };
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

    // رویدادها
    _bindEvents(container);

    // شروع loop
    _animate();

    // resize
    window.addEventListener('resize', () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    });

    console.log('✅ CityWorld initialized');
  }

  // ─────────────────────────────────────────────
  // نور
  // ─────────────────────────────────────────────
  function _buildLights() {
    // نور محیطی ملایم
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);

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
        const pl = new THREE.PointLight(0xffffee, 0.6, 18);
        pl.position.set(x, 6, z);
        scene.add(pl);
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
    character = new THREE.Group();

    // بدن
    const bodyMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 1.0, 10),
      new THREE.MeshPhongMaterial({ color: 0x1d4ed8, shininess: 20 })
    );
    bodyMesh.position.y = 1.2;
    bodyMesh.castShadow = true;
    character.add(bodyMesh);

    // سر
    const headMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 12, 12),
      new THREE.MeshPhongMaterial({ color: 0xfbbf24, shininess: 40 })
    );
    headMesh.position.y = 2.05;
    headMesh.castShadow = true;
    character.add(headMesh);

    // پاها
    [-0.18, 0.18].forEach((xOff, i) => {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.12, 0.85, 8),
        new THREE.MeshPhongMaterial({ color: 0x1e3a5f })
      );
      leg.position.set(xOff, 0.43, 0);
      leg.castShadow = true;
      character.add(leg);
    });

    // دست‌ها
    [-0.5, 0.5].forEach(xOff => {
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 0.7, 8),
        new THREE.MeshPhongMaterial({ color: 0x1d4ed8 })
      );
      arm.position.set(xOff, 1.35, 0);
      arm.rotation.z = xOff > 0 ? 0.5 : -0.5;
      arm.castShadow = true;
      character.add(arm);
    });

    // فلش بالای کاراکتر
    const arrowSprite = _makeTextSprite('⬆ شما', '#fbbf24');
    arrowSprite.position.set(0, 3.2, 0);
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
    window.addEventListener('keydown', e => {
      if (e.key in keys) { keys[e.key] = true; e.preventDefault(); }

      // ورود به ساختمان (فقط پیاده)
      if ((e.key === 'Enter' || e.key === ' ') && nearBuilding && !inCar && !inTank) {
        _enterBuilding(nearBuilding);
      }

      // F = سوار/پیاده ماشین
      if (e.key === 'f' || e.key === 'F') {
        if (!inCar && !inTank && nearCar)  _mountCar();
        else if (inCar)                     _unmountCar();
      }

      // T = سوار/پیاده تانک
      if (e.key === 't' || e.key === 'T') {
        if (!inTank && !inCar && nearTank)  _mountTank();
        else if (inTank)                    _unmountTank();
      }

      // R = نمای اول شخص / سوم شخص
      if (e.key === 'r' || e.key === 'R') {
        _toggleCameraMode();
      }
    });

    window.addEventListener('keyup', e => {
      if (e.key in keys) keys[e.key] = false;
    });

    // ─── موس: نگاه کردن + شلیک ───────────────
    container.addEventListener('click', e => {
      // درخواست pointer lock برای نگاه با موس
      if (document.pointerLockElement !== container) {
        container.requestPointerLock();
        return;
      }
      // شلیک
      const isTankShot = inTank;
      _shoot(isTankShot); // تانک = گلوله انفجاری
    });

    container.addEventListener('contextmenu', e => {
      e.preventDefault();
      // کلیک راست = نشانه‌گیری toggle
      isAiming = !isAiming;
      if (weapon) {
        weapon.position.set(isAiming ? 0 : 0.35, isAiming ? -0.15 : -0.28, -0.6);
        weapon.rotation.y = isAiming ? 0 : -0.05;
      }
    });

    // ─── pointer lock: حرکت دوربین با موس ───
    document.addEventListener('mousemove', e => {
      if (document.pointerLockElement !== container) return;
      const sens = 0.002;
      // چرخش کاراکتر / وسیله نقلیه
      const target = inTank ? tank : inCar ? carMesh : character;
      if (target) target.rotation.y -= e.movementX * sens;
    });

    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === container;
      const hint = document.getElementById('city-pointer-hint');
      if (hint) hint.style.display = locked ? 'none' : 'flex';
    });

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
    });
  }

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
    // ریست HUD
    const hint = document.getElementById('city-controls-hint');
    if (hint) hint.innerHTML = `
      <p><span class="key">W</span><span class="key">A</span><span class="key">S</span><span class="key">D</span> یا فلش‌ها — حرکت</p>
      <p><span class="key">Enter</span> یا <span class="key">Space</span> — ورود به ساختمان</p>
      <p><span class="key">F</span> — سوار ماشین</p>
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
    requestAnimationFrame(_animate);
    const delta = Math.min(clock.getDelta(), 0.05); // cap برای جلوگیری از جهش

    // حرکت کاراکتر / ماشین / تانک
    _updateMovement(delta);

    // NPC
    _updateNPCs(delta);

    // هلی‌کوپتر
    _updateHelicopter(delta);

    // تانک
    _updateTank(delta);

    // گلوله‌ها
    _updateBullets(delta);

    // دود
    _updateSmoke(delta);

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
    if (inTank) {
      // تانک فقط در _animate مستقیم آپدیت می‌شه — اینجا skip
    } else if (inCar) {
      _updateCarMovement(delta);
    } else {
      _updateCharacterMovement(delta);
    }
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

  // حرکت کاراکتر پیاده
  function _updateCharacterMovement(delta) {
    const camYaw = Math.atan2(
      camera.position.x - character.position.x,
      camera.position.z - character.position.z
    );

    let moveX = 0;
    let moveZ = 0;

    if (keys.w || keys.ArrowUp    || (joystickActive && joystickDelta.y < -0.2)) moveZ =  1;
    if (keys.s || keys.ArrowDown  || (joystickActive && joystickDelta.y >  0.2)) moveZ = -1;
    if (keys.a || keys.ArrowLeft  || (joystickActive && joystickDelta.x < -0.2)) moveX =  1;
    if (keys.d || keys.ArrowRight || (joystickActive && joystickDelta.x >  0.2)) moveX = -1;

    if (joystickActive) {
      moveX = -joystickDelta.x;
      moveZ = -joystickDelta.y;
    }

    if (moveX !== 0 || moveZ !== 0) {
      const cosY = Math.cos(camYaw);
      const sinY = Math.sin(camYaw);
      const worldX = moveX * cosY + moveZ * sinY;
      const worldZ = -moveX * sinY + moveZ * cosY;

      const speed = MOVE_SPEED * delta;
      const newX = character.position.x + worldX * speed;
      const newZ = character.position.z + worldZ * speed;

      if (!_collides(newX, newZ)) {
        character.position.x = newX;
        character.position.z = newZ;
      }

      const angle = Math.atan2(worldX, worldZ);
      character.rotation.y = angle;

      character.position.x = Math.max(-185, Math.min(185, character.position.x));
      character.position.z = Math.max(-185, Math.min(185, character.position.z));

      // انیمیشن راه رفتن
      const t = performance.now() * 0.008;
      character.children.forEach((c, i) => {
        if (i === 2) c.rotation.x =  Math.sin(t) * 0.4;
        if (i === 3) c.rotation.x = -Math.sin(t) * 0.4;
        if (i === 4) c.rotation.x = -Math.sin(t) * 0.25;
        if (i === 5) c.rotation.x =  Math.sin(t) * 0.25;
      });
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
    return false;
  }

  // ─────────────────────────────────────────────
  // بررسی نزدیکی به ساختمان و ماشین
  // ─────────────────────────────────────────────
  function _checkProximity() {
    // ─── فقط پیاده: بررسی نزدیکی ساختمان ───
    if (!inCar) {
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

    } else {
      // ─── داخل ماشین یا تانک: فقط ریست ساختمان‌ها ───
      nearBuilding = null;
      nearCar = false;
      nearTank = false;
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
    if (inTank && tank) {
      // دوربین پشت تانک
      const dist = 18;
      const height = 8;
      const targetX = tank.position.x - Math.sin(tank.rotation.y) * dist;
      const targetY = tank.position.y + height;
      const targetZ = tank.position.z - Math.cos(tank.rotation.y) * dist;
      camera.position.x += (targetX - camera.position.x) * 0.08;
      camera.position.y += (targetY - camera.position.y) * 0.08;
      camera.position.z += (targetZ - camera.position.z) * 0.08;
      camera.lookAt(tank.position.x, tank.position.y + 2, tank.position.z);
    } else if (inCar) {
      // دوربین پشت ماشین، کمی بالاتر
      const dist = 14;
      const height = 6;
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
      // دوربین پشت کاراکتر
      if (_firstPerson) {
        // اول شخص — دوربین داخل سر کاراکتر
        camera.position.x += (character.position.x - camera.position.x) * 0.3;
        camera.position.y += (character.position.y + 1.8 - camera.position.y) * 0.3;
        camera.position.z += (character.position.z - camera.position.z) * 0.3;
        camera.rotation.y = character.rotation.y + Math.PI;
        if (weapon) weapon.visible = true;
      } else {
        const targetX = character.position.x - Math.sin(character.rotation.y) * 14;
        const targetY = character.position.y + 10;
        const targetZ = character.position.z - Math.cos(character.rotation.y) * 14;
        camera.position.x += (targetX - camera.position.x) * 0.07;
        camera.position.y += (targetY - camera.position.y) * 0.07;
        camera.position.z += (targetZ - camera.position.z) * 0.07;
        camera.lookAt(character.position.x, character.position.y + 1.5, character.position.z);
        if (weapon) weapon.visible = true;
      }
    }
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

    // کاراکتر (پیاده)
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
      const npc = _makeCharacterMesh(cfg.color, cfg.headColor);
      npc.userData = {
        name: cfg.name,
        role: cfg.role,
        speed: cfg.speed,
        state: 'walk',       // walk | enter | inside | exit
        target: null,        // ساختمان مقصد
        insideTimer: 0,
        waitTimer: 0,
        angle: (idx / NPC_CONFIGS.length) * Math.PI * 2,
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
      label.position.set(0, 3.5, 0);
      label.scale.set(3, 1.2, 1);
      npc.add(label);

      scene.add(npc);
      npcs.push(npc);
    });
  }

  // ساخت mesh کاراکتر با رنگ دلخواه
  function _makeCharacterMesh(bodyColor, headColor) {
    const group = new THREE.Group();

    // بدن
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.9, 8),
      new THREE.MeshPhongMaterial({ color: bodyColor })
    );
    body.position.y = 1.1; body.castShadow = true;
    group.add(body);

    // سر
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 10),
      new THREE.MeshPhongMaterial({ color: headColor })
    );
    head.position.y = 1.9; head.castShadow = true;
    group.add(head);

    // پاها
    [-0.15, 0.15].forEach(x => {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.09, 0.75, 6),
        new THREE.MeshPhongMaterial({ color: 0x1e293b })
      );
      leg.position.set(x, 0.38, 0); leg.castShadow = true;
      group.add(leg);
    });

    return group;
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
          _animateNPCLegs(npc, delta);
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
        _animateNPCLegs(npc, delta);
      }
    });
  }

  // انیمیشن ساده پاهای NPC
  let _npcLegTime = 0;
  function _animateNPCLegs(npc, delta) {
    _npcLegTime += delta * 6;
    // پاها: ایندکس ۳ و ۴ (بعد از body, head)
    const legs = npc.children.filter((c, i) => i >= 2 && i <= 3);
    legs.forEach((leg, i) => {
      leg.rotation.x = Math.sin(_npcLegTime + i * Math.PI) * 0.5;
    });
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
    return BUILDINGS_CONFIG.some(b => {
      const dx = x - b.position.x, dz = z - b.position.z;
      const hw = b.width / 2 + radius, hd = b.depth / 2 + radius;
      return Math.abs(dx) < hw && Math.abs(dz) < hd;
    });
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
  }

  function _updateHelicopter(delta) {
    if (!helicopter) return;
    helicopterAngle += HELI_SPEED;

    // حرکت دایره‌ای
    helicopter.position.x = Math.cos(helicopterAngle) * helicopterRadius;
    helicopter.position.z = Math.sin(helicopterAngle) * helicopterRadius;
    // حرکت بالا-پایین ملایم
    helicopter.position.y = helicopterHeight + Math.sin(helicopterAngle * 3) * 2;
    // چرخش رو به جهت حرکت
    helicopter.rotation.y = -helicopterAngle + Math.PI / 2;

    // چرخش روتورها
    const mr = helicopter.getObjectByName('mainRotor');
    if (mr) mr.rotation.y += delta * 15;
    const tr = helicopter.getObjectByName('tailRotor');
    if (tr) tr.rotation.x += delta * 20;

    // چشمک نور
    const hl = helicopter.getObjectByName('heliLight');
    if (hl) hl.intensity = (Math.sin(Date.now() * 0.01) > 0) ? 2 : 0;
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

    // چرخش برج با ماوس (اگر در تانک باشیم)
    if (isAiming) {
      const dome = tank.getObjectByName('turretDome');
      if (dome) {
        // برج دنبال دوربین می‌چرخه
        dome.rotation.y = -tank.rotation.y + camera.rotation.y;
      }
    }
  }

  function _mountTank() {
    inTank = true;
    tankVelocity = 0;
    character.visible = false;
    const lbl = tank.getObjectByName('tankLabel');
    if (lbl) lbl.visible = false;
    _showToast('🪖 داخل تانک — WASD حرکت، کلیک شلیک، T پیاده');
    const hint = document.getElementById('city-controls-hint');
    if (hint) hint.innerHTML = `
      <p><span class="key">W</span><span class="key">S</span> — گاز / ترمز</p>
      <p><span class="key">A</span><span class="key">D</span> — فرمان</p>
      <p><span class="key">کلیک</span> — شلیک توپ</p>
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
    camera.add(weapon);

    // پیش‌نماش (crosshair) در HUD
    _buildCrosshair();
  }

  function _buildCrosshair() {
    const existing = document.getElementById('city-crosshair');
    if (existing) return;
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
    document.body.appendChild(ch);

    // HUD آمار تیراندازی
    const statsDiv = document.createElement('div');
    statsDiv.id = 'city-weapon-stats';
    statsDiv.style.cssText = `
      position:fixed;bottom:14px;left:50%;transform:translateX(-50%);
      background:rgba(0,0,0,0.6);color:#fff;font-size:0.75rem;
      padding:6px 16px;border-radius:8px;z-index:500;pointer-events:none;
      font-family:Vazirmatn,Tahoma,sans-serif;border:1px solid rgba(255,255,255,0.1);`;
    statsDiv.innerHTML = `🔫 <span id="city-ammo">∞</span>  💀 <span id="city-kills">0</span>  🎯 <span id="city-shots">0</span>`;
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
    lastShootTime = now;
    shotsFired++;
    const el = document.getElementById('city-shots');
    if (el) el.textContent = shotsFired;

    const bullet = _getFreeBullet();
    if (!bullet) return;

    // جهت از مرکز صفحه
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const dir = raycaster.ray.direction.clone().normalize();

    // موقعیت شروع = دهانه لوله اسلحه
    const barrelTip = new THREE.Vector3(0.35, -0.28, -0.6);
    barrelTip.applyMatrix4(camera.matrixWorld);

    bullet.position.copy(barrelTip);
    bullet.userData.velocity = dir.multiplyScalar(BULLET_SPEED);
    bullet.userData.life = BULLET_LIFE;
    bullet.userData.active = true;
    bullet.userData.isExplosive = !!isExplosive;
    bullet.visible = true;
    bullets.push(bullet);

    // فلاش
    if (muzzleFlash) { muzzleFlash.intensity = 4; setTimeout(() => { if(muzzleFlash) muzzleFlash.intensity = 0; }, 60); }

    // recoil اسلحه
    if (weapon) {
      weapon.position.z += 0.04;
      setTimeout(() => { if(weapon) weapon.position.z -= 0.04; }, 80);
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
      // حرکت گلوله
      b.position.x += b.userData.velocity.x * delta;
      b.position.y += b.userData.velocity.y * delta - 3 * delta; // گرانش ملایم
      b.position.z += b.userData.velocity.z * delta;

      // برخورد با NPC
      npcs.forEach(npc => {
        if (!npc.visible) return;
        const dx = npc.position.x - b.position.x;
        const dz = npc.position.z - b.position.z;
        const dy = npc.position.y + 1 - b.position.y;
        if (Math.sqrt(dx*dx + dy*dy + dz*dz) < 1.2) {
          _hitNPC(npc);
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

  function _hitNPC(npc) {
    kills++;
    const el = document.getElementById('city-kills');
    if (el) el.textContent = kills;
    _showToast('💥 هدف اصابت شد!');
    // NPC زمین می‌خوره
    npc.rotation.x = -Math.PI / 2;
    npc.position.y = 0;
    const ud = npc.userData;
    ud.state = 'dead';
    // بعد ۳ ثانیه دوباره بلند می‌شه
    setTimeout(() => {
      npc.rotation.x = 0;
      npc.position.y = 0;
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
  function destroy() {    if (renderer) {
      renderer.dispose();
      const el = renderer.domElement;
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
    scene = null; camera = null; renderer = null;
    buildings = []; labels = [];
    window.removeEventListener('keydown', () => {});
    window.removeEventListener('keyup', () => {});
  }

  return { init, destroy };

})();
