const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");

let score = 0;

const target = {
  x: 100,
  y: 100,
  radius: 25,
  dx: 3,
  dy: 2
};

function drawTarget() {
  ctx.beginPath();
  ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
  ctx.fillStyle = "red";
  ctx.fill();
  ctx.closePath();
}

function updateTarget() {
  target.x += target.dx;
  target.y += target.dy;

  if (target.x - target.radius < 0 || target.x + target.radius > canvas.width) {
    target.dx *= -1;
  }

  if (target.y - target.radius < 0 || target.y + target.radius > canvas.height) {
    target.dy *= -1;
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawTarget();
  updateTarget();
  requestAnimationFrame(draw);
}

canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const dist = Math.sqrt((mouseX - target.x) ** 2 + (mouseY - target.y) ** 2);

  if (dist <= target.radius) {
    score++;
    scoreEl.textContent = score;

    target.x = Math.random() * (canvas.width - 50) + 25;
    target.y = Math.random() * (canvas.height - 50) + 25;
  }
});

draw();