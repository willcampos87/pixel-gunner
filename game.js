// ============================================================
// PIXEL GUNNER — Top-Down Shooter
// ============================================================

const GAME_W = 480;
const GAME_H = 270;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = GAME_W;
canvas.height = GAME_H;

// Scale canvas to fill window maintaining aspect ratio
function resizeCanvas() {
  const scaleX = window.innerWidth / GAME_W;
  const scaleY = window.innerHeight / GAME_H;
  const scale = Math.min(scaleX, scaleY);
  canvas.style.width = (GAME_W * scale) + 'px';
  canvas.style.height = (GAME_H * scale) + 'px';
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ============================================================
// INPUT MANAGER
// ============================================================
const Input = {
  keys: {},
  mouse: { x: GAME_W / 2, y: GAME_H / 2, down: false, justClicked: false },

  init() {
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });

    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = GAME_W / rect.width;
      const scaleY = GAME_H / rect.height;
      this.mouse.x = (e.clientX - rect.left) * scaleX;
      this.mouse.y = (e.clientY - rect.top) * scaleY;
    });
    canvas.addEventListener('mousedown', e => {
      if (e.button === 0) { this.mouse.down = true; this.mouse.justClicked = true; }
    });
    canvas.addEventListener('mouseup', e => {
      if (e.button === 0) this.mouse.down = false;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  },

  flush() { this.mouse.justClicked = false; }
};

// ============================================================
// SCENE MANAGER
// ============================================================
const SceneManager = {
  scenes: {},
  stack: [],

  register(name, scene) { this.scenes[name] = scene; },

  push(name, data) {
    const scene = this.scenes[name];
    this.stack.push(scene);
    scene.enter(data || {});
  },

  pop() {
    this.stack.pop();
    if (this.stack.length > 0) {
      const top = this.stack[this.stack.length - 1];
      if (top.resume) top.resume();
    }
  },

  replace(name, data) {
    if (this.stack.length > 0) this.stack.pop();
    this.push(name, data);
  },

  update(dt) {
    if (this.stack.length > 0) {
      this.stack[this.stack.length - 1].update(dt);
    }
  },

  draw(ctx) {
    if (this.stack.length > 0) {
      this.stack[this.stack.length - 1].draw(ctx);
    }
  }
};

// ============================================================
// PARTICLE SYSTEM
// ============================================================
const Particles = {
  list: [],

  spawn(x, y, color, count, speed, life, size = 2.5) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.4 + Math.random() * 0.6);
      this.list.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life, maxLife: life,
        color,
        size: size * (0.5 + Math.random() * 0.8)
      });
    }
  },

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.90;
      p.vy *= 0.90;
      p.life -= dt;
      if (p.life <= 0) this.list.splice(i, 1);
    }
  },

  draw(ctx) {
    for (const p of this.list) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  },

  clear() { this.list = []; }
};

// ============================================================
// BULLET POOL
// ============================================================
const Bullets = {
  active: [],
  inactive: [],

  fire(x, y, angle, speed, radius, damage, color, isEnemy = false) {
    const b = this.inactive.pop() || {};
    b.x = x; b.y = y;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.radius = radius;
    b.damage = damage;
    b.color = color;
    b.isEnemy = isEnemy;
    b.active = true;
    this.active.push(b);
  },

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const b = this.active[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < -10 || b.x > GAME_W + 10 || b.y < -10 || b.y > GAME_H + 10) {
        this.active.splice(i, 1);
        this.inactive.push(b);
      }
    }
  },

  remove(i) {
    const b = this.active.splice(i, 1)[0];
    this.inactive.push(b);
  },

  draw(ctx) {
    for (const b of this.active) {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();

      // Bright center
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  clear() {
    this.inactive.push(...this.active);
    this.active = [];
  }
};

// ============================================================
// COLLISION HELPERS
// ============================================================
function circlesOverlap(ax, ay, ar, bx, by, br) {
  const dx = ax - bx, dy = ay - by;
  const minDist = ar + br;
  return (dx * dx + dy * dy) < minDist * minDist;
}

// ============================================================
// SCORING / PERSISTENCE
// ============================================================
const Score = {
  current: 0,
  high: parseInt(localStorage.getItem('pgHighScore') || '0', 10),

  add(n) { this.current += n; },
  reset() { this.current = 0; },

  save() {
    if (this.current > this.high) {
      this.high = this.current;
      localStorage.setItem('pgHighScore', this.high.toString());
      return true; // new record
    }
    return false;
  }
};

// ============================================================
// DRAW HELPERS
// ============================================================
function drawPixelText(ctx, text, x, y, size, color, align = 'left') {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
}

function drawHeart(ctx, cx, cy, size, fill) {
  // fill: 2=full, 1=half, 0=empty
  ctx.save();
  ctx.translate(cx, cy);

  const s = size;
  function heartPath() {
    ctx.beginPath();
    ctx.moveTo(0, s * 0.3);
    ctx.bezierCurveTo(-s * 0.8, -s * 0.4, -s * 1.2, s * 0.6, 0, s * 1.1);
    ctx.bezierCurveTo(s * 1.2, s * 0.6, s * 0.8, -s * 0.4, 0, s * 0.3);
    ctx.closePath();
  }

  // Empty outline
  heartPath();
  ctx.strokeStyle = '#c00';
  ctx.lineWidth = 0.8;
  ctx.fillStyle = '#300';
  ctx.fill();
  ctx.stroke();

  if (fill === 2) {
    heartPath();
    ctx.fillStyle = '#e33';
    ctx.fill();
    ctx.stroke();
  } else if (fill === 1) {
    // Half heart — clip left half
    ctx.save();
    ctx.beginPath();
    ctx.rect(-s * 1.5, -s, 0, s * 2.5);
    ctx.clip();
    heartPath();
    ctx.fillStyle = '#e33';
    ctx.fill();
    ctx.restore();
    heartPath();
    ctx.strokeStyle = '#c00';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  ctx.restore();
}

// ============================================================
// PLAYER
// ============================================================
class Player {
  constructor() {
    this.x = GAME_W / 2;
    this.y = GAME_H / 2;
    this.speed = 100;
    this.radius = 7;
    this.gunAngle = 0;
    this.walkFrame = 0;
    this.walkTimer = 0;
    this.lives = 3;
    this.health = 2; // sub-life: 2 half-hearts each life
    this.maxHealth = 2;
    this.invincible = false;
    this.invincTimer = 0;
    this.flashVisible = true;
    this.shootCooldown = 0;
    this.shootRate = 0.18; // seconds between shots
  }

  takeDamage(amount) {
    if (this.invincible) return false;
    this.health -= amount;
    if (this.health <= 0) {
      this.lives--;
      this.health = this.maxHealth;
    }
    this.invincible = true;
    this.invincTimer = 1.5;
    Particles.spawn(this.x, this.y, '#f55', 12, 90, 0.5);
    return this.lives <= 0;
  }

  update(dt, enemies) {
    // Invincibility flash
    if (this.invincible) {
      this.invincTimer -= dt;
      this.flashVisible = Math.floor(this.invincTimer / 0.1) % 2 === 0;
      if (this.invincTimer <= 0) {
        this.invincible = false;
        this.flashVisible = true;
      }
    }

    // Movement
    let dx = 0, dy = 0;
    if (Input.keys['ArrowLeft']  || Input.keys['KeyA']) dx -= 1;
    if (Input.keys['ArrowRight'] || Input.keys['KeyD']) dx += 1;
    if (Input.keys['ArrowUp']    || Input.keys['KeyW']) dy -= 1;
    if (Input.keys['ArrowDown']  || Input.keys['KeyS']) dy += 1;

    const moving = dx !== 0 || dy !== 0;
    if (moving) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len; dy /= len;
      this.x += dx * this.speed * dt;
      this.y += dy * this.speed * dt;

      // Walk animation
      this.walkTimer += dt;
      if (this.walkTimer > 0.08) {
        this.walkTimer = 0;
        this.walkFrame = (this.walkFrame + 1) % 8;
      }
    }

    // Clamp to screen
    this.x = Math.max(this.radius, Math.min(GAME_W - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(GAME_H - this.radius, this.y));

    // Gun angle toward mouse
    this.gunAngle = Math.atan2(Input.mouse.y - this.y, Input.mouse.x - this.x);

    // Shooting
    this.shootCooldown -= dt;
    if (Input.mouse.down && this.shootCooldown <= 0) {
      this.shoot();
    }
  }

  shoot() {
    this.shootCooldown = this.shootRate;
    const bx = this.x + Math.cos(this.gunAngle) * 12;
    const by = this.y + Math.sin(this.gunAngle) * 12;
    Bullets.fire(bx, by, this.gunAngle, 320, 3, 1, '#ffe066');

    // Muzzle flash
    Particles.spawn(bx, by, '#fff', 3, 60, 0.12, 1.5);
    Particles.spawn(bx, by, '#ffe066', 2, 40, 0.15, 2);
  }

  draw(ctx) {
    if (!this.flashVisible) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    const legSwing = Math.sin((this.walkFrame / 8) * Math.PI * 2) * 4;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(1, 9, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.fillStyle = '#335';
    ctx.fillRect(-5, 5, 4, 7 + legSwing);
    ctx.fillRect(1, 5, 4, 7 - legSwing);

    // Body
    ctx.fillStyle = '#3a9';
    ctx.fillRect(-6, -7, 12, 13);

    // Chest detail
    ctx.fillStyle = '#2c7';
    ctx.fillRect(-4, -5, 4, 5);

    // Head
    ctx.fillStyle = '#f5c5a3';
    ctx.fillRect(-5, -15, 10, 10);

    // Eyes (always face gun direction)
    const eyeDir = this.gunAngle > -Math.PI / 2 && this.gunAngle < Math.PI / 2 ? 1 : -1;
    ctx.fillStyle = '#222';
    ctx.fillRect(eyeDir * 1, -12, 2, 2);

    // Hair
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(-5, -15, 10, 3);

    // Gun arm (rotates with gunAngle)
    ctx.save();
    ctx.rotate(this.gunAngle);
    // Arm
    ctx.fillStyle = '#f5c5a3';
    ctx.fillRect(3, -2, 6, 4);
    // Gun body
    ctx.fillStyle = '#555';
    ctx.fillRect(7, -2, 5, 4);
    // Barrel
    ctx.fillStyle = '#333';
    ctx.fillRect(12, -1, 7, 2);
    ctx.restore();

    ctx.restore();
  }
}

// ============================================================
// ENEMY BASE CLASS
// ============================================================
class Enemy {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.dead = false;
    this.flashTimer = 0;
  }

  takeDamage(amount) {
    this.hp -= amount;
    this.flashTimer = 0.12;
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  die() {
    this.dead = true;
    Particles.spawn(this.x, this.y, this.color, 15, 110, 0.7);
    Particles.spawn(this.x, this.y, '#fff', 5, 80, 0.3, 1.5);
    Score.add(this.scoreValue);
  }

  drawFlash(ctx, drawFn) {
    if (this.flashTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.8;
      drawFn(ctx, '#fff');
      ctx.restore();
    } else {
      drawFn(ctx, this.color);
    }
  }

  updateFlash(dt) {
    if (this.flashTimer > 0) this.flashTimer -= dt;
  }
}

// ============================================================
// CHASER ENEMY
// ============================================================
class Chaser extends Enemy {
  constructor(x, y) {
    super(x, y, 'chaser');
    this.hp = 1;
    this.maxHp = 1;
    this.speed = 55;
    this.radius = 7;
    this.color = '#e44';
    this.scoreValue = 10;
    this.angle = 0;
    this.wobbleTimer = Math.random() * Math.PI * 2;
  }

  update(dt, player, enemies) {
    this.updateFlash(dt);
    this.wobbleTimer += dt * 3;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      this.angle = Math.atan2(dy, dx);
      this.x += (dx / dist) * this.speed * dt;
      this.y += (dy / dist) * this.speed * dt;
    }
  }

  draw(ctx) {
    this.drawFlash(ctx, (ctx, color) => {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      // Body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();

      // Spiky detail
      ctx.fillStyle = color === '#fff' ? '#fff' : '#c22';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + this.wobbleTimer;
        const sx = Math.cos(a) * (this.radius + 2);
        const sy = Math.sin(a) * (this.radius + 2);
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Eyes
      ctx.fillStyle = '#fff';
      ctx.fillRect(2, -4, 3, 3);
      ctx.fillRect(2, 1, 3, 3);
      ctx.fillStyle = '#111';
      ctx.fillRect(3, -3, 2, 2);
      ctx.fillRect(3, 2, 2, 2);

      ctx.restore();
    });
  }
}

// ============================================================
// SHOOTER ENEMY
// ============================================================
class Shooter extends Enemy {
  constructor(x, y) {
    super(x, y, 'shooter');
    this.hp = 2;
    this.maxHp = 2;
    this.speed = 50;
    this.radius = 8;
    this.color = '#44e';
    this.scoreValue = 25;
    this.angle = 0;
    this.fireTimer = 1.5 + Math.random() * 1.5;
    this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    this.strafeTimer = 0;
    this.standoffDist = 90 + Math.random() * 30;
  }

  update(dt, player, enemies) {
    this.updateFlash(dt);

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    this.angle = Math.atan2(dy, dx);

    if (dist > this.standoffDist + 10) {
      this.x += (dx / dist) * this.speed * dt;
      this.y += (dy / dist) * this.speed * dt;
    } else if (dist < this.standoffDist - 10) {
      this.x -= (dx / dist) * this.speed * 0.6 * dt;
      this.y -= (dy / dist) * this.speed * 0.6 * dt;
    } else {
      // Strafe
      this.strafeTimer += dt;
      if (this.strafeTimer > 2) { this.strafeDir *= -1; this.strafeTimer = 0; }
      const perpX = -dy / dist;
      const perpY = dx / dist;
      this.x += perpX * this.speed * 0.5 * this.strafeDir * dt;
      this.y += perpY * this.speed * 0.5 * this.strafeDir * dt;
    }

    // Fire
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = 2.2 + Math.random();
      const fireAngle = Math.atan2(player.y - this.y, player.x - this.x);
      // Small spread
      const spread = (Math.random() - 0.5) * 0.15;
      Bullets.fire(this.x, this.y, fireAngle + spread, 130, 3, 1, '#88f', true);
      Particles.spawn(this.x + Math.cos(fireAngle) * 10, this.y + Math.sin(fireAngle) * 10, '#88f', 4, 50, 0.2);
    }

    // Clamp
    this.x = Math.max(0, Math.min(GAME_W, this.x));
    this.y = Math.max(0, Math.min(GAME_H, this.y));
  }

  draw(ctx) {
    this.drawFlash(ctx, (ctx, color) => {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      // Body
      ctx.fillStyle = color;
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = color === '#fff' ? '#fff' : '#224';
      ctx.fillRect(-5, -5, 10, 10);

      // Barrel
      ctx.fillStyle = color === '#fff' ? '#fff' : '#66b';
      ctx.fillRect(6, -2, 8, 4);

      // Eyes
      ctx.fillStyle = '#0ff';
      ctx.fillRect(-4, -3, 3, 3);
      ctx.fillRect(-4, 1, 3, 3);

      ctx.restore();
    });
  }
}

// ============================================================
// TANK ENEMY
// ============================================================
class Tank extends Enemy {
  constructor(x, y) {
    super(x, y, 'tank');
    this.hp = 6;
    this.maxHp = 6;
    this.speed = 32;
    this.radius = 11;
    this.color = '#888';
    this.scoreValue = 50;
    this.angle = 0;
    this.treadOffset = 0;
  }

  update(dt, player, enemies) {
    this.updateFlash(dt);

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      this.angle = Math.atan2(dy, dx);
      this.x += (dx / dist) * this.speed * dt;
      this.y += (dy / dist) * this.speed * dt;
    }
    this.treadOffset = (this.treadOffset + this.speed * dt * 0.5) % 8;
  }

  draw(ctx) {
    this.drawFlash(ctx, (ctx, color) => {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      // Treads
      ctx.fillStyle = color === '#fff' ? '#fff' : '#555';
      ctx.fillRect(-12, -10, 24, 5);
      ctx.fillRect(-12, 5, 24, 5);

      // Tread lines
      if (color !== '#fff') {
        ctx.fillStyle = '#444';
        for (let i = 0; i < 5; i++) {
          const tx = -10 + ((i * 6 + this.treadOffset) % 22);
          ctx.fillRect(tx, -10, 2, 5);
          ctx.fillRect(tx, 5, 2, 5);
        }
      }

      // Body
      ctx.fillStyle = color;
      ctx.fillRect(-9, -6, 18, 12);

      // Turret
      ctx.fillStyle = color === '#fff' ? '#fff' : '#aaa';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();

      // Barrel
      ctx.fillStyle = color === '#fff' ? '#fff' : '#777';
      ctx.fillRect(4, -2, 10, 4);

      ctx.restore();
    });
  }
}

// ============================================================
// DASHER ENEMY
// ============================================================
class Dasher extends Enemy {
  constructor(x, y) {
    super(x, y, 'dasher');
    this.hp = 1;
    this.maxHp = 1;
    this.dashSpeed = 240;
    this.radius = 6;
    this.color = '#a4e';
    this.scoreValue = 30;
    this.angle = 0;
    this.state = 'pause'; // 'pause' | 'dash'
    this.stateTimer = 0.8 + Math.random() * 0.5;
    this.targetX = 0;
    this.targetY = 0;
    this.stretchX = 1;
    this.stretchY = 1;
  }

  update(dt, player, enemies) {
    this.updateFlash(dt);
    this.stateTimer -= dt;

    if (this.state === 'pause') {
      this.stretchX += (1 - this.stretchX) * dt * 8;
      this.stretchY += (1 - this.stretchY) * dt * 8;

      if (this.stateTimer <= 0) {
        // Lock onto current player position
        this.targetX = player.x;
        this.targetY = player.y;
        this.angle = Math.atan2(this.targetY - this.y, this.targetX - this.x);
        this.state = 'dash';
        this.stateTimer = 0.4;
        this.stretchX = 1.8;
        this.stretchY = 0.5;
      }
    } else {
      // Dash toward locked target
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 5 || this.stateTimer <= 0) {
        this.state = 'pause';
        this.stateTimer = 0.7 + Math.random() * 0.4;
      } else {
        this.x += (dx / dist) * this.dashSpeed * dt;
        this.y += (dy / dist) * this.dashSpeed * dt;
      }

      this.stretchX += (1 - this.stretchX) * dt * 5;
      this.stretchY += (1 - this.stretchY) * dt * 5;
    }
  }

  draw(ctx) {
    this.drawFlash(ctx, (ctx, color) => {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.scale(this.stretchX, this.stretchY);

      // Diamond shape
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(0, 7);
      ctx.lineTo(-10, 0);
      ctx.lineTo(0, -7);
      ctx.closePath();
      ctx.fill();

      // Inner diamond
      ctx.fillStyle = color === '#fff' ? '#fff' : '#c6f';
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(0, 4);
      ctx.lineTo(-6, 0);
      ctx.lineTo(0, -4);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    });
  }
}

// ============================================================
// HIVE ENEMY
// ============================================================
class Hive extends Enemy {
  constructor(x, y) {
    super(x, y, 'hive');
    this.hp = 10;
    this.maxHp = 10;
    this.speed = 22;
    this.radius = 14;
    this.color = '#e72';
    this.scoreValue = 75;
    this.angle = 0;
    this.spawnTimer = 4;
    this.pulseTimer = 0;
    this.spawnWarning = false;
    this.rotation = 0;
  }

  update(dt, player, enemies, spawnEnemyFn) {
    this.updateFlash(dt);
    this.rotation += dt * 0.8;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      this.x += (dx / dist) * this.speed * dt;
      this.y += (dy / dist) * this.speed * dt;
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 1 && !this.spawnWarning) {
      this.spawnWarning = true;
    }
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 4;
      this.spawnWarning = false;
      // Spawn 2 mini-chasers
      for (let i = 0; i < 2; i++) {
        const sa = Math.random() * Math.PI * 2;
        const mini = new MiniChaser(
          this.x + Math.cos(sa) * 20,
          this.y + Math.sin(sa) * 20
        );
        spawnEnemyFn(mini);
      }
      Particles.spawn(this.x, this.y, '#f90', 20, 100, 0.6);
    }

    this.pulseTimer += dt;
  }

  draw(ctx) {
    this.drawFlash(ctx, (ctx, color) => {
      ctx.save();
      ctx.translate(this.x, this.y);

      // Pulse scale when about to spawn
      const pulse = this.spawnWarning
        ? 1 + Math.sin(this.pulseTimer * 10) * 0.08
        : 1;
      ctx.scale(pulse, pulse);
      ctx.rotate(this.rotation);

      // Hexagon body
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
        const method = i === 0 ? 'moveTo' : 'lineTo';
        ctx[method](Math.cos(a) * 14, Math.sin(a) * 14);
      }
      ctx.closePath();
      ctx.fill();

      // Inner hex
      ctx.fillStyle = color === '#fff' ? '#fff' : '#f90';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
        const method = i === 0 ? 'moveTo' : 'lineTo';
        ctx[method](Math.cos(a) * 8, Math.sin(a) * 8);
      }
      ctx.closePath();
      ctx.fill();

      // Center dot
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
  }
}

// ============================================================
// MINI CHASER (spawned by Hive)
// ============================================================
class MiniChaser extends Chaser {
  constructor(x, y) {
    super(x, y);
    this.radius = 4;
    this.speed = 85;
    this.scoreValue = 5;
  }

  draw(ctx) {
    this.drawFlash(ctx, (ctx, color) => {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(1, -2, 2, 2);
      ctx.restore();
    });
  }
}

// ============================================================
// SENTINEL BOSS
// ============================================================
class Sentinel extends Enemy {
  constructor(x, y) {
    super(x, y, 'sentinel');
    this.maxHp = 80;
    this.hp = this.maxHp;
    this.speed = 0;
    this.radius = 18;
    this.color = '#aaa';
    this.scoreValue = 500;
    this.angle = 0;
    this.phase = 1;
    this.phaseTimer = 0;
    this.transitioning = false;
    this.transitionTimer = 0;
    this.rotation = 0;

    // Phase timers
    this.attackTimer = 3;

    // Shield
    this.shieldHp = 0;
    this.shieldMaxHp = 0;
    this.shieldAngle = 0;

    // Minion spawn
    this.minionTimer = 0;

    // Enrage visual
    this.enrageFlash = 0;
  }

  getPhaseByHp() {
    const pct = this.hp / this.maxHp;
    if (pct > 0.75) return 1;
    if (pct > 0.5) return 2;
    if (pct > 0.25) return 3;
    return 4;
  }

  takeDamage(amount) {
    if (this.transitioning) return false;

    // Phase 2: hit shield first
    if (this.phase === 2 && this.shieldHp > 0) {
      this.shieldHp -= amount;
      this.flashTimer = 0.1;
      Particles.spawn(this.x, this.y, '#0ff', 6, 80, 0.3);
      return false;
    }

    return super.takeDamage(amount);
  }

  die() {
    this.dead = true;
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        Particles.spawn(this.x + (Math.random()-0.5)*30, this.y + (Math.random()-0.5)*30, '#f80', 20, 120, 0.8);
        Particles.spawn(this.x + (Math.random()-0.5)*30, this.y + (Math.random()-0.5)*30, '#fff', 8, 100, 0.5);
      }, i * 150);
    }
    Score.add(this.scoreValue);
  }

  checkPhaseTransition() {
    const newPhase = this.getPhaseByHp();
    if (newPhase > this.phase && !this.transitioning) {
      this.transitioning = true;
      this.transitionTimer = 1.5;
      this.phase = newPhase;

      if (this.phase === 2) {
        this.shieldHp = 8;
        this.shieldMaxHp = 8;
      }

      Particles.spawn(this.x, this.y, '#ff0', 30, 140, 1.0);
      return true;
    }
    return false;
  }

  update(dt, player, enemies, spawnEnemyFn) {
    this.updateFlash(dt);
    this.rotation += dt * 1.2;
    this.shieldAngle += dt * 2;

    if (this.transitioning) {
      this.transitionTimer -= dt;
      if (this.transitionTimer <= 0) this.transitioning = false;
      return;
    }

    this.checkPhaseTransition();

    // Phase-based movement
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    this.angle = Math.atan2(dy, dx);

    if (this.phase >= 3) {
      const spd = this.phase === 4 ? 40 : 20;
      if (dist > 0) {
        this.x += (dx / dist) * spd * dt;
        this.y += (dy / dist) * spd * dt;
      }
    }

    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      this.attack(player);
      this.attackTimer = this.phase === 4 ? 1.5 : 3;
    }

    // Phase 3+ spawn minions
    if (this.phase >= 3) {
      const spawnInterval = this.phase === 4 ? 2.5 : 5;
      this.minionTimer -= dt;
      if (this.minionTimer <= 0) {
        this.minionTimer = spawnInterval;
        for (let i = 0; i < 2; i++) {
          const sa = Math.random() * Math.PI * 2;
          spawnEnemyFn(new Chaser(
            this.x + Math.cos(sa) * 30,
            this.y + Math.sin(sa) * 30
          ));
        }
      }
    }

    // Phase 4 enrage flash
    if (this.phase === 4) {
      this.enrageFlash = (this.enrageFlash + dt * 6) % 1;
    }
  }

  attack(player) {
    const bulletSpeed = this.phase === 4 ? 180 : 120;

    if (this.phase === 1) {
      // 8-way radial
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        Bullets.fire(this.x, this.y, a, bulletSpeed, 4, 1, '#f0f', true);
      }
    } else if (this.phase === 2) {
      // Aimed shot
      const a = Math.atan2(player.y - this.y, player.x - this.x);
      Bullets.fire(this.x, this.y, a, bulletSpeed, 4, 1, '#f0f', true);
      Bullets.fire(this.x, this.y, a + 0.2, bulletSpeed * 0.9, 3, 1, '#f0f', true);
      Bullets.fire(this.x, this.y, a - 0.2, bulletSpeed * 0.9, 3, 1, '#f0f', true);
    } else if (this.phase === 3) {
      // Burst: 3 aimed shots
      const a = Math.atan2(player.y - this.y, player.x - this.x);
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          Bullets.fire(this.x, this.y, a, bulletSpeed, 4, 1, '#f0f', true);
        }, i * 180);
      }
    } else {
      // Phase 4: 12-way + aimed burst
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        Bullets.fire(this.x, this.y, a, bulletSpeed, 4, 1, '#f55', true);
      }
      const a = Math.atan2(player.y - this.y, player.x - this.x);
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          Bullets.fire(this.x, this.y, a + (Math.random()-0.5)*0.3, bulletSpeed * 1.2, 4, 1, '#f55', true);
        }, i * 120);
      }
    }

    Particles.spawn(this.x, this.y, '#f0f', 8, 60, 0.3);
  }

  draw(ctx) {
    // Phase 4 color cycle
    let bodyColor = this.color;
    if (this.phase === 4) {
      bodyColor = this.enrageFlash < 0.5 ? '#f55' : '#f80';
    }

    ctx.save();
    ctx.translate(this.x, this.y);

    // Octagon body
    const sides = 8;
    const r = this.radius;
    const drawOctagon = (ctx, fillColor, radius) => {
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2 + this.rotation;
        const method = i === 0 ? 'moveTo' : 'lineTo';
        ctx[method](Math.cos(a) * radius, Math.sin(a) * radius);
      }
      ctx.closePath();
      ctx.fill();
    };

    if (this.flashTimer > 0) {
      drawOctagon(ctx, '#fff', r);
    } else {
      drawOctagon(ctx, bodyColor, r);
      drawOctagon(ctx, this.phase === 4 ? '#f00' : '#666', r - 5);
    }

    // Eye in center
    ctx.fillStyle = this.phase === 4 ? '#f00' : '#0ff';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(Math.cos(this.angle) * 2, Math.sin(this.angle) * 2, 2, 0, Math.PI * 2);
    ctx.fill();

    // Phase 2 shield
    if (this.phase === 2 && this.shieldHp > 0) {
      const shieldPct = this.shieldHp / this.shieldMaxHp;
      const numPieces = Math.ceil(8 * shieldPct);
      ctx.strokeStyle = '#0ff';
      ctx.lineWidth = 2;
      for (let i = 0; i < numPieces; i++) {
        const a = (i / 8) * Math.PI * 2 + this.shieldAngle;
        const sx = Math.cos(a) * (r + 8);
        const sy = Math.sin(a) * (r + 8);
        ctx.fillStyle = 'rgba(0,255,255,0.6)';
        ctx.fillRect(sx - 3, sy - 3, 6, 6);
      }
    }

    ctx.restore();
  }
}

// ============================================================
// LEVEL DEFINITIONS
// ============================================================
const LEVELS = [
  {
    name: 'LEVEL 1',
    subtitle: 'INCOMING THREAT',
    newEnemies: ['CHASER'],
    newEnemyColors: ['#e44'],
    wave: [
      { t: 0,  type: 'chaser', count: 3 },
      { t: 8,  type: 'chaser', count: 4 },
      { t: 16, type: 'chaser', count: 4 },
      { t: 24, type: 'chaser', count: 6 },
    ]
  },
  {
    name: 'LEVEL 2',
    subtitle: 'THEY SHOOT BACK',
    newEnemies: ['SHOOTER'],
    newEnemyColors: ['#44e'],
    wave: [
      { t: 0,  type: 'chaser',  count: 4 },
      { t: 6,  type: 'shooter', count: 2 },
      { t: 12, type: 'chaser',  count: 4 },
      { t: 18, type: 'shooter', count: 3 },
      { t: 24, type: 'chaser',  count: 5 },
      { t: 28, type: 'shooter', count: 3 },
    ]
  },
  {
    name: 'LEVEL 3',
    subtitle: 'HEAVY METAL',
    newEnemies: ['TANK', 'DASHER'],
    newEnemyColors: ['#888', '#a4e'],
    wave: [
      { t: 0,  type: 'chaser',  count: 4 },
      { t: 4,  type: 'tank',    count: 1 },
      { t: 8,  type: 'dasher',  count: 2 },
      { t: 12, type: 'shooter', count: 2 },
      { t: 16, type: 'tank',    count: 2 },
      { t: 20, type: 'dasher',  count: 3 },
      { t: 25, type: 'chaser',  count: 5 },
      { t: 28, type: 'tank',    count: 2 },
    ]
  },
  {
    name: 'LEVEL 4',
    subtitle: 'THE HIVE AWAKENS',
    newEnemies: ['HIVE'],
    newEnemyColors: ['#e72'],
    wave: [
      { t: 0,  type: 'chaser',  count: 5 },
      { t: 5,  type: 'hive',    count: 1 },
      { t: 10, type: 'shooter', count: 3 },
      { t: 16, type: 'tank',    count: 2 },
      { t: 20, type: 'hive',    count: 1 },
      { t: 24, type: 'dasher',  count: 4 },
      { t: 28, type: 'chaser',  count: 6 },
    ]
  },
  {
    name: 'LEVEL 5',
    subtitle: 'THE SENTINEL',
    newEnemies: ['SENTINEL'],
    newEnemyColors: ['#aaa'],
    isBoss: true,
    wave: [
      { t: 0, type: 'sentinel', count: 1 },
    ]
  }
];

// ============================================================
// SPAWN HELPERS
// ============================================================
function randomEdgePosition(margin = 20) {
  const edge = Math.floor(Math.random() * 4);
  switch (edge) {
    case 0: return { x: Math.random() * GAME_W, y: -margin };
    case 1: return { x: GAME_W + margin,        y: Math.random() * GAME_H };
    case 2: return { x: Math.random() * GAME_W, y: GAME_H + margin };
    default: return { x: -margin,               y: Math.random() * GAME_H };
  }
}

function createEnemy(type, x, y) {
  switch (type) {
    case 'chaser':   return new Chaser(x, y);
    case 'shooter':  return new Shooter(x, y);
    case 'tank':     return new Tank(x, y);
    case 'dasher':   return new Dasher(x, y);
    case 'hive':     return new Hive(x, y);
    case 'sentinel': return new Sentinel(GAME_W / 2, -30);
    default:         return new Chaser(x, y);
  }
}

// ============================================================
// SCREEN SHAKE
// ============================================================
const ScreenShake = {
  intensity: 0,
  duration: 0,

  shake(intensity, duration) {
    this.intensity = intensity;
    this.duration = duration;
  },

  update(dt) {
    if (this.duration > 0) this.duration -= dt;
    else this.intensity = 0;
  },

  apply(ctx) {
    if (this.duration > 0) {
      const sx = (Math.random() - 0.5) * this.intensity * 2;
      const sy = (Math.random() - 0.5) * this.intensity * 2;
      ctx.translate(sx, sy);
    }
  }
};

// ============================================================
// STARFIELD (shared background)
// ============================================================
const Stars = {
  stars: [],
  init() {
    this.stars = [];
    for (let i = 0; i < 80; i++) {
      this.stars.push({
        x: Math.random() * GAME_W,
        y: Math.random() * GAME_H,
        size: Math.random() * 1.5 + 0.5,
        brightness: Math.random() * 0.6 + 0.3,
        twinkle: Math.random() * Math.PI * 2
      });
    }
  },
  update(dt) {
    for (const s of this.stars) s.twinkle += dt * 2;
  },
  draw(ctx) {
    for (const s of this.stars) {
      const alpha = s.brightness * (0.7 + Math.sin(s.twinkle) * 0.3);
      ctx.fillStyle = `rgba(200,220,255,${alpha})`;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
  }
};

// ============================================================
// HUD DRAWING
// ============================================================
function drawHUD(ctx, player, level, score) {
  // Background bar
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, GAME_W, 18);

  // Hearts
  const heartSize = 5;
  let px = 4;
  for (let l = 0; l < player.lives; l++) {
    drawHeart(ctx, px + heartSize, 9, heartSize, 2);
    px += heartSize * 2 + 4;
  }
  // Spent lives (empty outlines)
  for (let l = player.lives; l < 3; l++) {
    drawHeart(ctx, px + heartSize, 9, heartSize, 0);
    px += heartSize * 2 + 4;
  }

  // Score
  drawPixelText(ctx, `SCORE: ${String(score).padStart(6,'0')}`, GAME_W / 2, 3, 9, '#ff0', 'center');

  // Level
  drawPixelText(ctx, `LV ${level}`, GAME_W - 4, 3, 9, '#8ef', 'right');
}

function drawBossBar(ctx, boss) {
  const barW = GAME_W - 40;
  const barH = 7;
  const bx = 20;
  const by = GAME_H - 16;

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(bx - 2, by - 2, barW + 4, barH + 4);

  ctx.fillStyle = '#300';
  ctx.fillRect(bx, by, barW, barH);

  const pct = boss.hp / boss.maxHp;
  const phaseColor = ['#f55', '#f0f', '#f80', '#f00'][boss.phase - 1];
  ctx.fillStyle = phaseColor;
  ctx.fillRect(bx, by, barW * pct, barH);

  // Shield bar overlay
  if (boss.phase === 2 && boss.shieldHp > 0) {
    ctx.fillStyle = 'rgba(0,255,255,0.4)';
    ctx.fillRect(bx, by, barW * (boss.shieldHp / boss.shieldMaxHp), barH);
  }

  drawPixelText(ctx, 'SENTINEL', GAME_W / 2, by - 10, 7, '#f0f', 'center');
}

// ============================================================
// MENU SCENE
// ============================================================
const MenuScene = {
  blinkTimer: 0,
  showBlink: true,

  enter() {
    Stars.init();
    this.blinkTimer = 0;
    this.showBlink = true;
  },

  update(dt) {
    Stars.update(dt);
    this.blinkTimer += dt;
    if (this.blinkTimer > 0.5) {
      this.blinkTimer = 0;
      this.showBlink = !this.showBlink;
    }

    if (Input.keys['Enter'] || Input.keys['Space']) {
      SceneManager.replace('game');
    }
  },

  draw(ctx) {
    // Background
    ctx.fillStyle = '#050810';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    Stars.draw(ctx);

    // Decorative grid
    ctx.strokeStyle = 'rgba(0,100,200,0.08)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < GAME_W; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, GAME_H); ctx.stroke();
    }
    for (let y = 0; y < GAME_H; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(GAME_W, y); ctx.stroke();
    }

    // Title
    ctx.fillStyle = '#ff0';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('PIXEL', GAME_W / 2, 40);
    ctx.fillStyle = '#f55';
    ctx.fillText('GUNNER', GAME_W / 2, 76);

    // Subtitle
    drawPixelText(ctx, ':: TOP-DOWN SHOOTER ::', GAME_W / 2, 118, 8, '#8ef', 'center');

    // Blink prompt
    if (this.showBlink) {
      drawPixelText(ctx, 'PRESS ENTER TO START', GAME_W / 2, 145, 9, '#fff', 'center');
    }

    // Controls
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(GAME_W / 2 - 100, 165, 200, 60);
    ctx.strokeStyle = '#445';
    ctx.lineWidth = 1;
    ctx.strokeRect(GAME_W / 2 - 100, 165, 200, 60);

    drawPixelText(ctx, 'CONTROLS', GAME_W / 2, 170, 7, '#8ef', 'center');
    drawPixelText(ctx, 'ARROWS / WASD  MOVE', GAME_W / 2, 184, 6, '#ccc', 'center');
    drawPixelText(ctx, 'MOUSE          AIM', GAME_W / 2, 196, 6, '#ccc', 'center');
    drawPixelText(ctx, 'CLICK          FIRE', GAME_W / 2, 208, 6, '#ccc', 'center');

    // High score
    drawPixelText(ctx, `HIGH SCORE: ${String(Score.high).padStart(6,'0')}`, GAME_W / 2, 234, 7, '#f80', 'center');
  }
};

// ============================================================
// TRANSITION SCENE
// ============================================================
const TransitionScene = {
  level: 1,
  timer: 0,
  duration: 3.5,
  countdownPhase: 0,

  enter(data) {
    this.level = data.level;
    this.timer = 0;
    this.countdownPhase = 0;
    Stars.init();
  },

  update(dt) {
    this.timer += dt;
    if (this.timer >= this.duration || Input.keys['Space'] || Input.keys['Enter']) {
      SceneManager.replace('game', { level: this.level });
    }
  },

  draw(ctx) {
    ctx.fillStyle = 'rgba(0,0,20,0.95)';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    Stars.draw(ctx);

    const levelData = LEVELS[this.level - 1];

    // Level name
    ctx.fillStyle = '#ff0';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(levelData.name, GAME_W / 2, 30);

    drawPixelText(ctx, levelData.subtitle, GAME_W / 2, 65, 9, '#8ef', 'center');

    // New enemies
    if (levelData.newEnemies && levelData.newEnemies.length > 0) {
      drawPixelText(ctx, '-- NEW THREAT --', GAME_W / 2, 90, 7, '#f80', 'center');
      for (let i = 0; i < levelData.newEnemies.length; i++) {
        const cx = GAME_W / 2 + (i - (levelData.newEnemies.length - 1) / 2) * 60;
        ctx.fillStyle = levelData.newEnemyColors[i];
        ctx.beginPath();
        ctx.arc(cx, 120, 8, 0, Math.PI * 2);
        ctx.fill();
        drawPixelText(ctx, levelData.newEnemies[i], cx, 132, 6, levelData.newEnemyColors[i], 'center');
      }
    }

    // Boss warning
    if (levelData.isBoss) {
      const pulse = Math.sin(this.timer * 4) > 0;
      if (pulse) {
        drawPixelText(ctx, '!!! BOSS FIGHT !!!', GAME_W / 2, 155, 10, '#f55', 'center');
      }
    }

    // Countdown
    const remaining = Math.ceil(this.duration - this.timer);
    const countStr = remaining <= 0 ? 'GO!' : remaining.toString();
    const countColor = remaining <= 0 ? '#0f0' : '#fff';
    drawPixelText(ctx, countStr, GAME_W / 2, 195, 22, countColor, 'center');

    drawPixelText(ctx, 'SPACE to skip', GAME_W / 2, 248, 6, '#556', 'center');
  }
};

// ============================================================
// GAME OVER SCENE
// ============================================================
const GameOverScene = {
  alpha: 0,
  score: 0,
  newRecord: false,
  blinkTimer: 0,
  showBlink: true,

  enter(data) {
    this.alpha = 0;
    this.score = data.score || 0;
    this.newRecord = data.newRecord || false;
    this.blinkTimer = 0;
    this.showBlink = true;
    Stars.init();
  },

  update(dt) {
    this.alpha = Math.min(1, this.alpha + dt * 1.2);
    this.blinkTimer += dt;
    if (this.blinkTimer > 0.6) { this.blinkTimer = 0; this.showBlink = !this.showBlink; }

    if (this.alpha >= 1 && (Input.keys['Enter'] || Input.keys['Space'])) {
      SceneManager.replace('menu');
    }
  },

  draw(ctx) {
    ctx.fillStyle = '#050810';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    Stars.draw(ctx);

    ctx.globalAlpha = this.alpha;

    ctx.fillStyle = '#f22';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('GAME OVER', GAME_W / 2, 40);

    drawPixelText(ctx, `SCORE: ${String(this.score).padStart(6,'0')}`, GAME_W / 2, 90, 11, '#ff0', 'center');
    drawPixelText(ctx, `BEST:  ${String(Score.high).padStart(6,'0')}`, GAME_W / 2, 110, 11, '#f80', 'center');

    if (this.newRecord && this.showBlink) {
      drawPixelText(ctx, '*** NEW RECORD! ***', GAME_W / 2, 135, 9, '#0f0', 'center');
    }

    if (this.alpha >= 1 && this.showBlink) {
      drawPixelText(ctx, 'PRESS ENTER TO CONTINUE', GAME_W / 2, 175, 7, '#aaa', 'center');
    }

    ctx.globalAlpha = 1;
  }
};

// ============================================================
// WIN SCENE
// ============================================================
const WinScene = {
  alpha: 0,
  score: 0,
  newRecord: false,
  timer: 0,

  enter(data) {
    this.alpha = 0;
    this.score = data.score || 0;
    this.newRecord = data.newRecord || false;
    this.timer = 0;
    Stars.init();
  },

  update(dt) {
    this.alpha = Math.min(1, this.alpha + dt);
    this.timer += dt;

    if (this.alpha >= 1 && (Input.keys['Enter'] || Input.keys['Space'])) {
      SceneManager.replace('menu');
    }
  },

  draw(ctx) {
    ctx.fillStyle = '#050810';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    Stars.draw(ctx);

    // Celebration particles are drawn by the system globally

    ctx.globalAlpha = this.alpha;

    ctx.fillStyle = '#ff0';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('YOU WIN!', GAME_W / 2, 40);

    drawPixelText(ctx, 'THE SENTINEL IS DEFEATED', GAME_W / 2, 75, 7, '#8ef', 'center');
    drawPixelText(ctx, `FINAL SCORE: ${String(this.score).padStart(6,'0')}`, GAME_W / 2, 110, 11, '#ff0', 'center');
    drawPixelText(ctx, `BEST:        ${String(Score.high).padStart(6,'0')}`, GAME_W / 2, 130, 11, '#f80', 'center');

    if (this.newRecord) {
      drawPixelText(ctx, '*** NEW RECORD! ***', GAME_W / 2, 158, 9, '#0f0', 'center');
    }

    if (this.alpha >= 1 && Math.sin(this.timer * 3) > 0) {
      drawPixelText(ctx, 'PRESS ENTER TO CONTINUE', GAME_W / 2, 195, 7, '#aaa', 'center');
    }

    ctx.globalAlpha = 1;
  }
};

// ============================================================
// GAME SCENE
// ============================================================
const GameScene = {
  player: null,
  enemies: [],
  levelIndex: 0,
  waveEvents: [],
  waveTimer: 0,
  totalEnemiesInWave: 0,
  enemiesDefeated: 0,
  levelClearTimer: 0,
  levelCleared: false,
  boss: null,
  difficultyTier: 0,

  enter(data) {
    data = data || {};
    Bullets.clear();
    Particles.clear();

    if (data.level) {
      this.levelIndex = data.level - 1;
    } else {
      this.levelIndex = 0;
      this.difficultyTier = 0;
      Score.reset();
    }

    this.player = new Player();
    this.enemies = [];
    this.boss = null;
    this.levelCleared = false;
    this.levelClearTimer = 0;

    this.startLevel();
  },

  startLevel() {
    const levelData = LEVELS[this.levelIndex];
    this.waveEvents = levelData.wave.map(e => ({ ...e, fired: false }));
    this.waveTimer = 0;
    this.totalEnemiesInWave = levelData.wave.reduce((sum, e) => sum + e.count, 0);
    this.enemiesDefeated = 0;
    this.levelCleared = false;
    this.enemies = [];
    this.boss = null;
    Bullets.clear();
  },

  spawnEnemy(enemy) {
    // Apply difficulty scaling
    if (this.difficultyTier > 0) {
      enemy.speed = (enemy.speed || 0) * (1 + this.difficultyTier * 0.15);
      enemy.hp = (enemy.hp || 1) + this.difficultyTier;
    }
    this.enemies.push(enemy);
  },

  update(dt) {
    ScreenShake.update(dt);
    Stars.update(dt);
    Particles.update(dt);
    Bullets.update(dt);

    if (this.levelCleared) {
      this.levelClearTimer -= dt;
      if (this.levelClearTimer <= 0) {
        this.advanceLevel();
      }
      return;
    }

    // Wave spawning
    this.waveTimer += dt;
    for (const event of this.waveEvents) {
      if (!event.fired && this.waveTimer >= event.t) {
        event.fired = true;
        for (let i = 0; i < event.count; i++) {
          const pos = randomEdgePosition();
          const enemy = createEnemy(event.type, pos.x, pos.y);
          this.spawnEnemy(enemy);
          if (event.type === 'sentinel') this.boss = enemy;
        }
      }
    }

    // Update player
    this.player.update(dt, this.enemies);

    // Update enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];

      if (e instanceof Hive) {
        e.update(dt, this.player, this.enemies, (enemy) => this.spawnEnemy(enemy));
      } else if (e instanceof Sentinel) {
        e.update(dt, this.player, this.enemies, (enemy) => this.spawnEnemy(enemy));
      } else {
        e.update(dt, this.player, this.enemies);
      }

      if (e.dead) {
        this.enemies.splice(i, 1);
        this.enemiesDefeated++;
        if (e === this.boss) this.boss = null;
      }
    }

    // Bullet-enemy collision
    for (let bi = Bullets.active.length - 1; bi >= 0; bi--) {
      const b = Bullets.active[bi];
      if (b.isEnemy) continue;

      let hit = false;
      for (const e of this.enemies) {
        if (circlesOverlap(b.x, b.y, b.radius, e.x, e.y, e.radius)) {
          e.takeDamage(b.damage);
          hit = true;
          Particles.spawn(b.x, b.y, e.color, 5, 70, 0.3);
          break;
        }
      }
      if (hit) Bullets.remove(bi);
    }

    // Enemy-bullet hit player
    for (let bi = Bullets.active.length - 1; bi >= 0; bi--) {
      const b = Bullets.active[bi];
      if (!b.isEnemy) continue;

      if (circlesOverlap(b.x, b.y, b.radius, this.player.x, this.player.y, this.player.radius)) {
        const dead = this.player.takeDamage(1);
        Bullets.remove(bi);
        ScreenShake.shake(3, 0.3);
        if (dead) { this.gameOver(); return; }
      }
    }

    // Enemy-player contact collision
    for (const e of this.enemies) {
      if (circlesOverlap(e.x, e.y, e.radius, this.player.x, this.player.y, this.player.radius)) {
        const dmg = e instanceof Tank ? 2 : 1;
        const dead = this.player.takeDamage(dmg);
        ScreenShake.shake(4, 0.4);
        if (dead) { this.gameOver(); return; }
      }
    }

    // Soft enemy separation
    for (let i = 0; i < this.enemies.length; i++) {
      for (let j = i + 1; j < this.enemies.length; j++) {
        const a = this.enemies[i], b = this.enemies[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist2 = dx * dx + dy * dy;
        const minDist = a.radius + b.radius;
        if (dist2 < minDist * minDist && dist2 > 0.001) {
          const dist = Math.sqrt(dist2);
          const push = (minDist - dist) / dist * 0.3;
          a.x += dx * push; a.y += dy * push;
          b.x -= dx * push; b.y -= dy * push;
        }
      }
    }

    // Check level clear
    const allFired = this.waveEvents.every(e => e.fired);
    if (allFired && this.enemies.length === 0 && !this.levelCleared) {
      this.levelCleared = true;
      this.levelClearTimer = 1.8;
      Particles.spawn(GAME_W / 2, GAME_H / 2, '#ff0', 40, 150, 1.2, 4);
      Particles.spawn(GAME_W / 2, GAME_H / 2, '#0f8', 30, 120, 1.0, 3);
    }
  },

  advanceLevel() {
    this.levelIndex++;
    if (this.levelIndex >= LEVELS.length) {
      // Beat the game — loop with increased difficulty
      this.levelIndex = 0;
      this.difficultyTier++;
      const newRecord = Score.save();
      Particles.spawn(GAME_W / 2, GAME_H / 2, '#ff0', 60, 180, 2.0, 5);
      SceneManager.replace('win', { score: Score.current, newRecord });
      return;
    }
    SceneManager.replace('transition', { level: this.levelIndex + 1 });
  },

  gameOver() {
    const newRecord = Score.save();
    SceneManager.replace('gameOver', { score: Score.current, newRecord });
  },

  draw(ctx) {
    // Background
    ctx.fillStyle = '#0a0f1a';
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    // Grid
    ctx.strokeStyle = 'rgba(0,80,160,0.06)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < GAME_W; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, GAME_H); ctx.stroke();
    }
    for (let y = 0; y < GAME_H; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(GAME_W, y); ctx.stroke();
    }

    Stars.draw(ctx);

    ctx.save();
    ScreenShake.apply(ctx);

    // Draw enemies
    for (const e of this.enemies) e.draw(ctx);

    // Draw player
    this.player.draw(ctx);

    // Draw bullets
    Bullets.draw(ctx);

    // Draw particles
    Particles.draw(ctx);

    ctx.restore();

    // HUD
    drawHUD(ctx, this.player, this.levelIndex + 1, Score.current);

    // Boss bar
    if (this.boss && !this.boss.dead) {
      drawBossBar(ctx, this.boss);
    }

    // Level clear overlay
    if (this.levelCleared) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, GAME_H / 2 - 20, GAME_W, 40);
      drawPixelText(ctx, 'LEVEL CLEAR!', GAME_W / 2, GAME_H / 2 - 10, 16, '#ff0', 'center');
    }
  }
};

// ============================================================
// INIT & START
// ============================================================
Input.init();
Stars.init();

SceneManager.register('menu', MenuScene);
SceneManager.register('game', GameScene);
SceneManager.register('transition', TransitionScene);
SceneManager.register('gameOver', GameOverScene);
SceneManager.register('win', WinScene);

SceneManager.push('menu');

let lastTime = 0;
function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  ctx.clearRect(0, 0, GAME_W, GAME_H);
  SceneManager.update(dt);
  SceneManager.draw(ctx);
  Input.flush();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
