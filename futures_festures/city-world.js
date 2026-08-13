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
      width: 4, height: 7, depth: 4,
    },
    {
      id: 'students',
      label: 'دانشجویان',
      icon: '🎓',
      page: 'students',
      role: ['manager', 'employee'],
      position: { x: 28, z: 0 },        // ← 12→28
      color: 0x10b981,
      roofColor: 0x047857,
      width: 4, height: 6, depth: 4,
    },
    {
      id: 'orders',
      label: 'سفارشات',
      icon: '📋',
      page: 'orders',
      role: ['manager', 'employee'],
      position: { x: -28, z: 0 },       // ← -12→-28
      color: 0xf59e0b,
      roofColor: 0xd97706,
      width: 4, height: 5, depth: 4,
    },
    {
      id: 'embassy',
      label: 'سفارت',
      icon: '🏛️',
      page: 'embassy',
      role: ['manager', 'employee'],
      position: { x: 0, z: 30 },        // ← 14→30
      color: 0xef4444,
      roofColor: 0xb91c1c,
      width: 5, height: 8, depth: 5,
    },
    {
      id: 'accounting',
      label: 'حسابداری',
      icon: '💰',
      page: 'accounting',
      role: ['manager', 'employee'],
      position: { x: 0, z: -30 },       // ← -14→-30
      color: 0x8b5cf6,
      roofColor: 0x6d28d9,
      width: 4, height: 6, depth: 4,
    },
    {
      id: 'tasks',
      label: 'مدیریت وظایف',
      icon: '✅',
      page: 'tasks',
      role: ['manager'],
      position: { x: 28, z: 30 },       // ← 12,14→28,30
      color: 0x06b6d4,
      roofColor: 0x0e7490,
      width: 4, height: 5, depth: 4,
    },
    {
      id: 'myTasks',
      label: 'وظایف من',
      icon: '📌',
      page: 'myTasks',
      role: ['employee'],
      position: { x: 28, z: -30 },      // ← 12,-14→28,-30
      color: 0xf97316,
      roofColor: 0xc2410c,
      width: 3, height: 5, depth: 3,
    },
    {
      id: 'chat',
      label: 'گفتگو',
      icon: '💬',
      page: 'personalChat',
      role: null,
      position: { x: -28, z: 30 },      // ← -12,14→-28,30
      color: 0xec4899,
      roofColor: 0xbe185d,
      width: 3, height: 4, depth: 3,
    },
    {
      id: 'workChecklist',
      label: 'چک‌لیست',
      icon: '☑️',
      page: 'workChecklist',
      role: ['employee'],
      position: { x: -28, z: -30 },     // ← -12,-14→-28,-30
      color: 0x14b8a6,
      roofColor: 0x0f766e,
      width: 3, height: 4, depth: 3,
    },
    {
      id: 'agentTasks',
      label: 'وظایف عامل',
      icon: '🔧',
      page: 'agentTasks',
      role: ['agent'],
      position: { x: 28, z: 0 },
      color: 0xa855f7,
      roofColor: 0x7e22ce,
      width: 4, height: 5, depth: 4,
    },
    {
      id: 'agentAccounting',
      label: 'حسابداری عامل',
      icon: '💳',
      page: 'agentAccounting',
      role: ['agent'],
      position: { x: -28, z: 0 },
      color: 0x84cc16,
      roofColor: 0x4d7c0f,
      width: 4, height: 5, depth: 4,
    },
    {
      id: 'companyDoor',
      label: 'در شرکت',
      icon: '🚪',
      page: 'companyDoor',
      role: ['manager', 'employee'],
      position: { x: 50, z: 0 },        // ← 24→50
      color: 0x64748b,
      roofColor: 0x334155,
      width: 3, height: 4, depth: 3,
    },
    {
      id: 'profile',
      label: 'تنظیمات',
      icon: '⚙️',
      page: 'profile',
      role: null,
      position: { x: -50, z: 0 },       // ← -24→-50
      color: 0x6b7280,
      roofColor: 0x374151,
      width: 3, height: 4, depth: 3,
    },
    {
      id: 'managementChat',
      label: 'گفتگو مدیریت',
      icon: '👥',
      page: 'managementChat',
      role: ['manager', 'employee'],
      position: { x: 0, z: 55 },        // ← 28→55
      color: 0x0284c7,
      roofColor: 0x0369a1,
      width: 4, height: 5, depth: 4,
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
  const MOVE_SPEED = 8;             // سرعت حرکت
  const ENTER_DISTANCE = 4.5;       // فاصله ورود به ساختمان

  // مقیاس minimap
  const MINIMAP_SCALE = 0.04;

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
    scene.background = new THREE.Color(0x87ceeb); // آسمان آبی روز
    scene.fog = new THREE.Fog(0x87ceeb, 40, 120);

    clock = new THREE.Clock();

    // دوربین
    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 200);
    camera.position.set(0, 10, -16);

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
    sun.position.set(30, 60, -40);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
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
    const geo = new THREE.PlaneGeometry(200, 200, 40, 40);
    const mat = new THREE.MeshLambertMaterial({ color: 0x4ade80 }); // سبز علف
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // چمن‌های تزئینی
    for (let i = 0; i < 80; i++) {
      const gx = (Math.random() - 0.5) * 180;
      const gz = (Math.random() - 0.5) * 180;
      // اگر نزدیک ساختمانی باشد skip
      const tooClose = BUILDINGS_CONFIG.some(b => {
        const dx = gx - b.position.x, dz = gz - b.position.z;
        return Math.sqrt(dx*dx + dz*dz) < 8;
      });
      if (tooClose) continue;
      const treeH = 2 + Math.random() * 2;
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.2, treeH, 6),
        new THREE.MeshLambertMaterial({ color: 0x8B4513 })
      );
      trunk.position.set(gx, treeH / 2, gz);
      trunk.castShadow = true;
      scene.add(trunk);

      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(1 + Math.random(), 2.5 + Math.random(), 6),
        new THREE.MeshLambertMaterial({ color: 0x228B22 })
      );
      crown.position.set(gx, treeH + 1.2, gz);
      crown.castShadow = true;
      scene.add(crown);
    }
  }

  // ─────────────────────────────────────────────
  // جاده‌ها
  // ─────────────────────────────────────────────
  function _buildRoads() {
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x374151 });
    const roadY = 0.02;

    // جاده افقی اصلی
    const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(100, 5), roadMat);
    hRoad.rotation.x = -Math.PI / 2;
    hRoad.position.set(0, roadY, 0);
    scene.add(hRoad);

    // جاده عمودی اصلی
    const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(5, 100), roadMat);
    vRoad.rotation.x = -Math.PI / 2;
    vRoad.position.set(0, roadY, 0);
    scene.add(vRoad);

    // خط‌کشی جاده
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0xffd700 });
    for (let i = -48; i < 50; i += 6) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 3), stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(i, roadY + 0.01, 0);
      scene.add(stripe);

      const stripe2 = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.2), stripeMat);
      stripe2.rotation.x = -Math.PI / 2;
      stripe2.position.set(0, roadY + 0.01, i);
      scene.add(stripe2);
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

    character.position.set(0, 0, -6);
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

    // موقعیت اولیه ماشین — کنار داشبورد روی جاده
    carMesh.position.set(8, 0, -10);
    carMesh.rotation.y = Math.PI / 2;
    scene.add(carMesh);
  }

  // ─────────────────────────────────────────────
  // آسمان / ابرها
  // ─────────────────────────────────────────────
  function _buildSkyDetails() {
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 12; i++) {
      const cloudGroup = new THREE.Group();
      const cx = (Math.random() - 0.5) * 160;
      const cy = 40 + Math.random() * 20;
      const cz = (Math.random() - 0.5) * 160;
      [0, -1.2, 1.2, -0.6, 0.6].forEach((dx, idx) => {
        const puff = new THREE.Mesh(
          new THREE.SphereGeometry(1.5 + Math.random() * 0.8, 7, 7),
          cloudMat
        );
        puff.position.set(dx * 1.5, Math.random() * 0.5, (Math.random() - 0.5) * 1.5);
        cloudGroup.add(puff);
      });
      cloudGroup.position.set(cx, cy, cz);
      cloudGroup.userData.cloudDrift = (Math.random() - 0.5) * 0.003;
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
      // ورود با Enter یا Space به ساختمان (فقط پیاده)
      if ((e.key === 'Enter' || e.key === ' ') && nearBuilding && !inCar) {
        _enterBuilding(nearBuilding);
      }
      // F = سوار/پیاده ماشین
      if (e.key === 'f' || e.key === 'F') {
        if (!inCar && nearCar) {
          _mountCar();
        } else if (inCar) {
          _unmountCar();
        }
      }
    });
    window.addEventListener('keyup', e => {
      if (e.key in keys) keys[e.key] = false;
    });

    // لمس موبایل
    _bindTouchJoystick();
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
    const delta = clock.getDelta();

    // حرکت کاراکتر
    _updateMovement(delta);

    // بررسی نزدیکی به ساختمان
    _checkProximity();

    // حرکت ابرها
    scene.children.forEach(obj => {
      if (obj.userData.cloudDrift) {
        obj.position.x += obj.userData.cloudDrift;
        if (obj.position.x > 80) obj.position.x = -80;
        if (obj.position.x < -80) obj.position.x = 80;
      }
    });

    // دوربین سوم شخص
    _updateCamera();

    // ابرها رو نسبت به دوربین بچرخون
    labels.forEach(s => s.lookAt(camera.position));

    renderer.render(scene, camera);

    // آپدیت minimap
    _updateMinimap();
  }

  // ─────────────────────────────────────────────
  // حرکت کاراکتر یا ماشین
  // ─────────────────────────────────────────────
  function _updateMovement(delta) {
    if (inCar) {
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

      // باند جهان
      carMesh.position.x = Math.max(-95, Math.min(95, carMesh.position.x));
      carMesh.position.z = Math.max(-95, Math.min(95, carMesh.position.z));

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

      character.position.x = Math.max(-95, Math.min(95, character.position.x));
      character.position.z = Math.max(-95, Math.min(95, character.position.z));

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

    } else {
      // ─── داخل ماشین: فقط ریست ساختمان‌ها ───
      nearBuilding = null;
      nearCar = false;
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
    if (inCar) {
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
      const targetX = character.position.x - Math.sin(character.rotation.y) * 14;
      const targetY = character.position.y + 10;
      const targetZ = character.position.z - Math.cos(character.rotation.y) * 14;

      camera.position.x += (targetX - camera.position.x) * 0.07;
      camera.position.y += (targetY - camera.position.y) * 0.07;
      camera.position.z += (targetZ - camera.position.z) * 0.07;

      camera.lookAt(
        character.position.x,
        character.position.y + 1.5,
        character.position.z
      );
    }
  }

  // ─────────────────────────────────────────────
  // Minimap 2D
  // ─────────────────────────────────────────────
  function _updateMinimap() {
    const canvas = document.getElementById('city-minimap');
    if (!canvas) return;
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
    if (!inCar) {
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

    // border
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, W, H);
  }

  // ─────────────────────────────────────────────
  // API عمومی
  // ─────────────────────────────────────────────
  function destroy() {
    if (renderer) {
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
