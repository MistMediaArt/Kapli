const initShader = () => {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const gl = canvas.getContext('webgl');
  if (!gl) return;

  const vsSource = `
    attribute vec4 aVertexPosition;
    void main() {
      gl_Position = aVertexPosition;
    }
  `;

  // Мягкий переливающийся абстрактный фон с палитрой:
  // #9C89B8 (Purple), #F0A6CA (Pink), #EFC3E6 (Light Pink), #B8BEDD (Blue)
  const fsSource = `
    precision mediump float;
    uniform vec2 u_resolution;
    uniform float u_time;

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution.xy;
      
      // Смещенные координаты для плавности
      float time = u_time * 0.15;
      
      // Создаем плавные волны
      float wave1 = sin(uv.x * 3.0 + time) * cos(uv.y * 2.0 + time * 0.7);
      float wave2 = sin(uv.x * 2.0 - time * 0.4) * cos(uv.y * 4.0 - time * 1.1);
      float wave3 = sin(uv.x * 1.5 + uv.y * 2.5 + time * 0.9);
      
      // Базовые цвета из вашей палитры
      vec3 c1 = vec3(0.61, 0.54, 0.72); // 9C89B8
      vec3 c2 = vec3(0.94, 0.65, 0.79); // F0A6CA
      vec3 c3 = vec3(0.94, 0.76, 0.90); // EFC3E6
      vec3 c4 = vec3(0.72, 0.75, 0.87); // B8BEDD
      
      // Нормализуем волны к диапазону 0..1
      float m1 = (wave1 + 1.0) * 0.5;
      float m2 = (wave2 + 1.0) * 0.5;
      float m3 = (wave3 + 1.0) * 0.5;
      
      // Смешиваем цвета
      vec3 col = mix(c1, c2, m1);
      col = mix(col, c4, m2);
      col = mix(col, c3, m3 * 0.5); // Немного добавим светлого розового
      
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
    },
    uniformLocations: {
      resolution: gl.getUniformLocation(shaderProgram, 'u_resolution'),
      time: gl.getUniformLocation(shaderProgram, 'u_time'),
    },
  };

  const positions = [
    1.0,  1.0,
   -1.0,  1.0,
    1.0, -1.0,
   -1.0, -1.0,
  ];

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  let animationFrameId;

  function render(time) {
    // Check if the canvas is visible
    if (canvas.classList.contains('hidden')) {
      animationFrameId = requestAnimationFrame(render);
      return;
    }

    const displayWidth = window.innerWidth;
    const displayHeight = window.innerHeight;
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    }

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(
        programInfo.attribLocations.vertexPosition,
        2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

    gl.useProgram(programInfo.program);

    gl.uniform2f(programInfo.uniformLocations.resolution, gl.canvas.width, gl.canvas.height);
    gl.uniform1f(programInfo.uniformLocations.time, time * 0.001);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    animationFrameId = requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
};

document.addEventListener('DOMContentLoaded', initShader);
