// 本地假的 OpenAI 兼容服务，只用于开发时验证链路，不参与正式使用。
// 按请求类型返回不同结果：普通生成 → SAMPLE；微调 → REFINED；角色设定 → CHAR_SAMPLE；灵感 → MOCK_IDEAS。
import http from 'node:http';

const PORT = Number(process.argv[2] || 43199);

const SAMPLE = {
  title: '霓虹女剑客',
  positive:
    'cinematic portrait of a cyberpunk female swordswoman turning to look at the camera, wet asphalt city street at night, neon signs reflecting in puddles, glowing katana with cyan edge light, short wet black hair, tattooed neck, worn leather jacket with high collar, rain droplets on skin, three-quarter view, shallow depth of field, 85mm lens, teal and magenta color grading, volumetric fog, highly detailed, sharp focus, 8k, professional lighting, cinematic composition',
  negative:
    'lowres, bad anatomy, bad hands, extra digits, worst quality, jpeg artifacts, signature, watermark, username, low quality, blurry, deformed, extra limbs',
  translation:
    '画面是一位赛博朋克女剑客的侧面回眸，湿漉漉的夜街与霓虹倒影构成青紫对比的色调，刀身的冷光勾出她的轮廓，镜头用 85mm 浅景深把背景推成虚化的光斑。',
  params: {
    aspect_ratio: '2:3',
    suggested_model: 'SDXL / Flux.1 dev',
    extra: 'Steps 28, CFG 6.5, Sampler DPM++ 2M Karras',
  },
  keywords: ['赛博朋克', '雨夜霓虹', '回眸构图', '冷青色光', '浅景深'],
};

// 微调后的「新版本」，用来验证前端确实换成了新结果
const REFINED = {
  ...SAMPLE,
  title: '霓虹女剑客 · 竖构图',
  positive:
    'vertical portrait composition, cinematic portrait of a cyberpunk female swordswoman turning to look at the camera, wet asphalt city street at night, neon signs reflecting in puddles, glowing katana with cyan edge light, short wet black hair, tattooed neck, worn leather jacket with high collar, rain droplets on skin, three-quarter view, shallow depth of field, 85mm lens, teal and magenta color grading, volumetric fog, highly detailed, sharp focus, 8k, professional lighting',
  params: { ...SAMPLE.params, aspect_ratio: '2:3', extra: 'Steps 30, CFG 7, Sampler DPM++ 2M Karras' },
};

// 角色设定（整段英文提示词 + 中文对照）
const CHAR_SAMPLE = {
  title: '地铁口的三个乐手',
  prompt_en:
    'candid street photography of three busking musicians performing at a subway station exit at dusk, an accordionist in his thirties with a narrow weathered face, stubble and round metal glasses sliding down his nose, wearing a pilled beige cable-knit cardigan over a faded navy tee and grey work trousers, eyes closed and head tilted back while pulling the bellows of a paint-chipped red accordion, beside him a girl in her early twenties with sweat-damp dark brown short hair and a silver eyebrow stud, sitting on an upturned plastic bucket in a black tank top and an oversized plaid shirt tied at the waist, striking a battered wooden drumstick against the bucket with her chin lifted toward him, a grey-templed man in an ill-fitting black suit with no tie standing in profile, violin on his shoulder with the bow still hovering, wet concrete steps scattered with instrument cases and loose coins, warm convenience-store signage and cool white light spilling from the station behind them, pedestrians with elongated shadows pausing to watch, overcast blue-hour sky, reflections pooling on the damp ground, medium shot from a slightly low angle, 35mm lens at f/2.8 with shallow depth of field, rule of thirds with a diagonally leading staircase, teal and amber color grading, volumetric light haze, highly detailed, sharp focus, 8k, cinematic lighting, professional composition',
  prompt_zh:
    '黄昏时分，三个街头乐手在地铁站出口即兴演出。手风琴手三十来岁，瘦长脸上有胡茬，圆框金属眼镜滑到鼻梁中间，米色粗针织开衫配着发白的深蓝T恤和灰色工装裤，闭着眼睛仰头拉动手风琴，那是一台边角掉漆的红色琴。旁边二十出头的女孩深棕色短发被汗黏在额角，左眉一枚银色眉钉，穿黑色背心、腰间系着过大的格纹衬衫，坐在倒扣的塑料桶上用木鼓槌敲击桶面，下巴微抬看向他。第三人鬓角发白，穿不合身的黑西装没打领带，侧身站着，小提琴架在肩上，琴弓还悬在半空。湿漉漉的水泥台阶上散落着琴盒和零钱，站内冷白光与便利店暖黄招牌在身后交叠，路人的影子被拉长，有行人停下围观。天色是阴沉的蓝调时刻，地面积水映出光斑。中景，略低机位仰拍，35mm 镜头 f/2.8 浅景深，三分法构图，台阶形成斜向引导线。青橙调色，有体积光雾感，细节丰富、焦点锐利，8k，电影级布光，专业构图。',
  aspect_ratio: '16:9',
};

// 角色提示词「微调后」的版本，用来验证前端确实换成了新结果
const CHAR_REFINED = {
  ...CHAR_SAMPLE,
  title: '地铁口的三个乐手 · 夜景',
  prompt_en:
    'nighttime candid street photography of three busking musicians performing under a subway station exit at nine in the evening, an accordionist in his thirties with a narrow weathered face, stubble and round metal glasses sliding down his nose, wearing a pilled beige cable-knit cardigan over a faded navy tee and grey work trousers, eyes closed and head tilted back while pulling the bellows of a paint-chipped red accordion, beside him a girl in her early twenties with sweat-damp dark brown short hair and a silver eyebrow stud, sitting on an upturned plastic bucket in a black tank top and an oversized plaid shirt tied at the waist, striking a battered wooden drumstick against the bucket with her chin lifted toward him, a grey-templed man in an ill-fitting black suit with no tie standing in profile, violin on his shoulder with the bow still hovering, wet concrete steps scattered with instrument cases and loose coins, warm sodium streetlamps overhead cutting through fine drizzle, shop windows glowing behind them, pedestrians with elongated shadows pausing to watch, pitch black sky, reflections pooling on the damp ground, medium shot from a slightly low angle, 35mm lens at f/2.8 with shallow depth of field, rule of thirds with a diagonally leading staircase, teal and amber color grading, volumetric light haze, highly detailed, sharp focus, 8k, cinematic lighting, professional composition',
  prompt_zh:
    '晚上九点，三个街头乐手在地铁站出口的路灯下演出。手风琴手三十来岁，瘦长脸上有胡茬，圆框金属眼镜滑到鼻梁中间，米色粗针织开衫配着发白的深蓝T恤和灰色工装裤，闭着眼睛仰头拉动手风琴，那是一台边角掉漆的红色琴。旁边二十出头的女孩深棕色短发被汗黏在额角，左眉一枚银色眉钉，穿黑色背心、腰间系着过大的格纹衬衫，坐在倒扣的塑料桶上用木鼓槌敲击桶面，下巴微抬看向他。第三人鬓角发白，穿不合身的黑西装没打领带，侧身站着，小提琴架在肩上，琴弓还悬在半空。湿漉漉的水泥台阶上散落着琴盒和零钱，头顶暖黄的钠灯穿过细雨，身后店铺橱窗亮着，路人的影子被拉得很长，有行人停下围观。夜色深沉，地面积水映出灯光。中景，略低机位仰拍，35mm 镜头 f/2.8 浅景深，三分法构图，台阶形成斜向引导线。青橙调色，有体积光雾感，细节丰富、焦点锐利，8k，电影级布光，专业构图。',
};

// 细分标签（服饰）示例
const SEG_SAMPLE = {
  title: '黑蕾丝哥特长裙',
  tags: 'black lace corset dress, sheer puff sleeves, tarnished silver buckles, layered velvet skirt, thigh-high leather boots, cameo choker, worn lace gloves, floor-length hem',
  translation: '黑色蕾丝束身长裙配薄纱泡泡袖，裙摆是多层天鹅绒；银色搭扣有氧化痕迹，搭配过膝皮靴、浮雕颈链和磨损的蕾丝手套。',
  keywords: ['黑蕾丝', '束身长裙', '银搭扣', '哥特'],
};

// 灵感接口返回的内容（一次 6 条）
const MOCK_IDEAS = [
  '凌晨四点的便利店门口，一个值夜班的人蹲在台阶上吃关东煮',
  '废弃地铁隧道里，一辆生锈的自行车靠在广告灯箱旁',
  '沙漠公路边的汽车旅馆，霓虹灯牌只亮着一半',
  '暴雨中的公交站台，两个陌生人共用一把漏了洞的伞',
  '老式钟表店的柜台上，几十只闹钟同时指向三点十七分',
  '雪后的寺庙屋檐下，一只狐狸踩着脚印慢慢走过',
];

// 从系统提示词里把「用户自定义置顶要求」抽出来（回显用，验证它确实发给了模型）
function extractApiPinned(sys) {
  const m = String(sys).match(/# 用户自定义置顶要求[^\n]*\n([\s\S]*?)\n\n（注意/);
  return m ? m[1].trim() : '';
}

// 从微调请求里抽出一段（回显用，方便验证请求内容）
function section(text, name) {
  const m = String(text).match(new RegExp(`【${name}】\\n([\\s\\S]*?)(?:\\n\\n|$)`));
  return m ? m[1].trim() : '';
}

function pickSample(payload) {
  const messages = payload?.messages || [];
  const sys = String(messages[0]?.content || '');
  const user = String(messages[1]?.content || '');
  const pinned = extractApiPinned(sys);

  // 细分标签：只按当前维度返回一组 tag
  if (sys.includes('细分标签工程师')) return SEG_SAMPLE;

  // 角色提示词的微调（注意要排在角色设定之前，前者的系统提示词里也含「多角色同框」）
  if (sys.includes('角色提示词修改器')) {
    const instruction = section(user, '用户的修改要求');
    return {
      ...CHAR_REFINED,
      prompt_zh: `收到修改要求「${instruction}」｜${CHAR_REFINED.prompt_zh}`,
    };
  }

  // 角色设定
  if (sys.includes('多角色同框')) {
    return pinned
      ? { ...CHAR_SAMPLE, prompt_zh: `【置顶要求已收到】${pinned}｜${CHAR_SAMPLE.prompt_zh}` }
      : CHAR_SAMPLE;
  }

  // 普通生成
  if (!sys.includes('修改器')) {
    return pinned
      ? { ...SAMPLE, translation: `【置顶要求已收到】${pinned}｜${SAMPLE.translation}` }
      : SAMPLE;
  }

  // 微调
  const instruction = section(user, '用户的修改要求');
  const prev = section(user, '原正向提示词');
  return {
    ...REFINED,
    translation: `收到修改要求「${instruction}」。模型收到的原提示词开头是：${prev.slice(0, 34)}`,
  };
}

const server = http.createServer((req, res) => {
  if (req.url === '/v1/models' || req.url === '/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ data: [{ id: 'mock-prompt-model' }, { id: 'mock-lite' }] }));
  }

  if (req.url.endsWith('/chat/completions') && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      let payload = null;
      try {
        payload = JSON.parse(body);
      } catch { /* 忽略 */ }

      const sys = String(payload?.messages?.[0]?.content || '');

      // 非流式请求（灵感走这条路）
      if (!payload?.stream) {
        const content = sys.includes('创意搭档')
          ? JSON.stringify(MOCK_IDEAS)
          : JSON.stringify(pickSample(payload));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
        }));
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      const text = JSON.stringify(pickSample(payload));
      let i = 0;
      const step = 24;
      const timer = setInterval(() => {
        if (i >= text.length) {
          clearInterval(timer);
          res.write('data: [DONE]\n\n');
          return res.end();
        }
        const piece = text.slice(i, i + step);
        i += step;
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`);
      }, 12);
      res.on('close', () => clearInterval(timer));
    });
    return;
  }

  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, '127.0.0.1', () => console.log(`mock openai on http://127.0.0.1:${PORT}/v1`));
