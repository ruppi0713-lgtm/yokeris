function createBoardView(canvas, preview, onAssetsReady) {
  const ctx = canvas.getContext('2d');
  const previewContext = preview.getContext('2d');
  const size = 30;
  const width = 300;
  const height = 600;
  const scale = canvas.width / width;
  const palette = [
    ['#e5809e', '#8c3454', '#3f162d'],
    ['#dca674', '#87603c', '#3b261d'],
    ['#9cddb0', '#447659', '#1b362d'],
    ['#e7ae79', '#9b5d37', '#462719'],
    ['#ffd188', '#a77b43', '#4e331a'],
    ['#a5bdf4', '#526c9f', '#262649'],
    ['#e8a0d4', '#904a78', '#411e3c'],
  ];
  ctx.scale(scale, scale);
  previewContext.scale(scale, scale);

  function surface(w, h) {
    const image = document.createElement('canvas');
    image.width = w * scale;
    image.height = h * scale;
    const brush = image.getContext('2d');
    brush.scale(scale, scale);
    return [image, brush];
  }

  function rounded(brush, x, y, w, h, radius) {
    brush.beginPath();
    brush.roundRect(x, y, w, h, radius);
  }

  const [backdrop, back] = surface(width, height);
  const wall = back.createLinearGradient(0, 0, width, 100);
  wall.addColorStop(0, '#70464d');
  wall.addColorStop(.12, '#37232d');
  wall.addColorStop(.77, '#291c26');
  wall.addColorStop(1, '#100b13');
  back.fillStyle = wall;
  back.fillRect(0, 0, width, height);
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      const tile = back.createLinearGradient(x, y, x + size, y + size);
      tile.addColorStop(0, '#100b135c');
      tile.addColorStop(.86, '#170f18b0');
      tile.addColorStop(1, '#73505786');
      back.fillStyle = tile;
      back.fillRect(x + 1, y + 1, size - 2, size - 2);
    }
  }
  const glow = back.createRadialGradient(68, 0, 5, 124, 172, 520);
  glow.addColorStop(0, '#f1847090');
  glow.addColorStop(.54, '#b4486528');
  glow.addColorStop(1, '#1a0d1b46');
  back.fillStyle = glow;
  back.fillRect(0, 0, width, height);
  back.strokeStyle = '#f0b1a275';
  back.lineWidth = 1.5;
  rounded(back, 1, 1, width - 2, height - 2, 8);
  back.stroke();

  const drinks = new Image();
  let tiles;

  function makeTiles() {
    return palette.map(([light, middle, dark], index) => {
      const [tile, brush] = surface(size, size);
      brush.fillStyle = '#0b070abe';
      rounded(brush, 1.5, 2.5, 27, 27, 5);
      brush.fill();
      const edge = brush.createLinearGradient(1, 1, 22, 28);
      edge.addColorStop(0, light);
      edge.addColorStop(.42, middle);
      edge.addColorStop(1, dark);
      brush.fillStyle = edge;
      rounded(brush, .75, .75, 27.5, 27.5, 5);
      brush.fill();

      const face = brush.createLinearGradient(2, 2, 21, 28);
      face.addColorStop(0, middle);
      face.addColorStop(1, dark);
      brush.fillStyle = face;
      rounded(brush, 2.5, 2.5, 24, 23, 4);
      brush.fill();
      brush.fillStyle = '#0c080b88';
      brush.beginPath();
      brush.ellipse(15.5, 23.5, 7.5, 1.4, 0, 0, Math.PI * 2);
      brush.fill();
      if (drinks.naturalWidth) {
        const frame = drinks.naturalHeight;
        brush.drawImage(drinks, index * frame, 0, frame, frame, .5, -.75, 28.5, 28.5);
      }
      brush.fillStyle = '#ffe7dd7a';
      brush.fillRect(4.5, 2, 9, .6);
      return tile;
    });
  }

  tiles = makeTiles();
  drinks.addEventListener('load', () => {
    tiles = makeTiles();
    onAssetsReady();
  });
  drinks.src = 'drink-tiles.png';

  function paintTile(context, x, y, type) {
    context.drawImage(tiles[type - 1], x, y, size, size);
  }

  function paintPiece(context, piece, left, top) {
    piece.m.forEach((row, y) => row.forEach((cell, x) => {
      if (cell) paintTile(context, left + x * size, top + y * size, piece.t);
    }));
  }

  function drawPreview(piece) {
    const previewWidth = preview.width / scale;
    const previewHeight = preview.height / scale;
    previewContext.clearRect(0, 0, previewWidth, previewHeight);
    const left = (previewWidth - size * piece.m[0].length) / 2;
    const top = (previewHeight - size * piece.m.length) / 2;
    paintPiece(previewContext, piece, left, top);
  }

  function drawBoard(board, current, flash) {
    ctx.drawImage(backdrop, 0, 0, width, height);
    board.forEach((row, y) => row.forEach((type, x) => {
      if (type) paintTile(ctx, x * size, y * size, type);
    }));
    if (current) paintPiece(ctx, current, current.x * size, current.y * size);
    if (flash) {
      ctx.fillStyle = '#1b0d17e8';
      rounded(ctx, 58, 267, 184, 66, 9);
      ctx.fill();
      ctx.strokeStyle = '#ffbf6d';
      ctx.stroke();
      ctx.fillStyle = '#ffe1a3';
      ctx.font = '900 34px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('乾杯!!', 150, 300);
    }
  }

  return { drawBoard, drawPreview };
}
