// VALID — 物語と規則のデータ
(function () {
  // ---- 日付 ----
  // DAY 1 = 2089.05.01。最終便(第12便)は 2089.05.30。
  V.DATES = { 1: "2089.05.01", 2: "2089.05.02", 3: "2089.05.03" };
  V.FINAL_FLIGHT = "2089.05.30";
  V.SEAL_CURRENT = "E-12";
  V.SEAL_OLD = "E-11";
  V.LAST_DAY = 3; // 試作版

  // ---- 規則 ----
  // key は照合で使う欄の名前。day はその規則が始まる日。
  V.RULES = [
    { key: "rule.expiry", day: 1, page: 0, text: "ゲノムIDは有効期限内であること。" },
    { key: "rule.status", day: 1, page: 0, text: "判定が INVALID の乗客・乗員は搭乗できない。" },
    { key: "rule.staff", day: 1, page: 0, text: "INVALID の地上職員は、本人の作業許可証があれば【限定】で通す。" },
    { key: "rule.genome", day: 1, page: 0, text: "採血検体の16塩基が、IDのゲノム署名と一致すること。" },
    { key: "rule.height", day: 1, page: 0, text: "実測身長が、IDの予測身長の範囲内であること。" },
    { key: "rule.detain", day: 1, page: 0, text: "身体・検体の偽装を指摘できたら【拘束】。" },
    { key: "rule.ticket", day: 2, page: 1, text: "乗客と乗員は、本人名義・本日付の搭乗券を持つこと。" },
    { key: "rule.seal", day: 2, page: 1, text: "搭乗券の印章は現行の第12版(E-12)に限る。" },
    { key: "rule.heart", day: 2, page: 1, text: "心拍に乱れがあれば不適格。医療記録で既往が示されていれば可。" },
    { key: "rule.hair", day: 3, page: 2, text: "毛髪検体は、毛根が付いていること。" },
    { key: "rule.mass", day: 3, page: 2, text: "計量台の体重は、搭乗券の申告質量の±0.5kg以内。" },
    { key: "rule.xray", day: 3, page: 2, text: "X線で衣服の下に不審物があれば【拘束】。" }
  ];
  V.RULE_PAGES = ["基本", "書類", "検体"];

  // その日に有効な検査の種類
  V.dayChecks = day => {
    const c = ["expiry", "status", "genome", "height"];
    if (day >= 2) c.push("ticket", "seal", "heart");
    if (day >= 3) c.push("hair", "mass", "xray");
    return c;
  };

  // ---- 朝の新聞 ----
  V.NEWS = {
    1: {
      head: "最終便まであと29日 ― 第7ゲート、増便体制に",
      body: "地上最後の出発ゲートとなった第7ゲートで、エリュシオン行きの増便が始まった。港湾局は「適格者の移住を最後の一人まで」と話す。",
      side: ["第11便、定刻に軌道へ", "地表の気温、5月の最高を更新"],
      rules: ["ゲノムIDの有効期限", "VALID の判定", "地上職員の作業許可証", "採血の16塩基照合", "予測身長と実測身長"]
    },
    2: {
      head: "搭乗券の印章、第12版に切り替え",
      body: "軌道の当局は本日から搭乗券の印章を第12版に改めた。旧版の券は無効となる。あわせて乗客の心拍確認を義務づけた。",
      side: ["梯子屋の摘発、先月比2倍", "第12便の機体、組み立て進む"],
      rules: ["本日付・本人名義の搭乗券", "印章 第12版(E-12)", "心拍の確認と医療記録"]
    },
    3: {
      head: "検体の持ち込み相次ぐ ― 毛髪と血液に注意",
      body: "他人の毛髪や血液を持ち込み、遺伝子照合をすり抜けようとする手口が増えている。当局は本日から毛根の確認と計量を義務づけた。",
      side: ["最終便の乗員名簿、今夜公開", "帰還ゲートの再開は未定"],
      rules: ["毛髪検体の毛根", "申告質量と体重(±0.5kg)", "X線の不審物"]
    }
  };

  // ---- アイリの手紙(夜) ----
  V.LETTERS = {
    1: "きょう、まどから ロケットが みえたよ。\nあれも ゲートから とぶの?",
    2: "くすり、にがいけど ちゃんと のんでるよ。\nエリュシオンって、ほしが ちかいの?",
    3: "ねえ、わたしも あのロケットに のれる?"
  };

  // ---- 家計 ----
  V.START_CREDITS = 40;
  V.PAY_CORRECT = 5;
  V.PAY_DETAIN_BONUS = 5;
  V.CITATION_FREE = 2;
  V.CITATION_FINE = 5;
  V.EXPENSES = [
    { key: "rent", label: "家賃", cost: 20, must: true },
    { key: "food", label: "食費", cost: 10 },
    { key: "power", label: "電気代", cost: 5 },
    { key: "meds", label: "アイリの薬", cost: 15 }
  ];

  // ---- 名前 ----
  V.NAMES = {
    first: ["アナ", "ベン", "カミラ", "ダニエル", "エマ", "フェリクス", "グレタ", "ハンナ", "イヴァン", "ユナ", "ケンジ", "レオ", "マヤ", "ニコ", "オリヴァー", "パウラ", "ルカ", "サラ", "トマ", "ヴェラ", "ユリ", "ソラ", "ミロ", "イネス", "ハル", "アキ", "ノア", "エリン", "ダリア", "テオ"],
    last: [["アベル", "ABEL"], ["ブラント", "BRANT"], ["コスタ", "COSTA"], ["ドラン", "DORAN"], ["エルデ", "ELDE"], ["ファロ", "FARO"], ["グラス", "GLASS"], ["ホルム", "HOLM"], ["イシダ", "ISHIDA"], ["ヤンセン", "JANSEN"], ["カトウ", "KATO"], ["リンド", "LIND"], ["モロー", "MOREAU"], ["ナカノ", "NAKANO"], ["オステン", "OSTEN"], ["ペトロフ", "PETROV"], ["クイン", "QUINN"], ["ロッシ", "ROSSI"], ["サトウ", "SATO"], ["タナー", "TANNER"], ["ウルフ", "WOLF"], ["ワイス", "WEISS"], ["ヨシダ", "YOSHIDA"], ["ザイツ", "SEITZ"], ["ミナミ", "MINAMI"], ["コール", "COLE"], ["アリマ", "ARIMA"]]
  };
  V.LATIN = { "アナ": "ANA", "ベン": "BEN", "カミラ": "CAMILA", "ダニエル": "DANIEL", "エマ": "EMMA", "フェリクス": "FELIX", "グレタ": "GRETA", "ハンナ": "HANNA", "イヴァン": "IVAN", "ユナ": "YUNA", "ケンジ": "KENJI", "レオ": "LEO", "マヤ": "MAYA", "ニコ": "NICO", "オリヴァー": "OLIVER", "パウラ": "PAULA", "ルカ": "LUCA", "サラ": "SARA", "トマ": "TOMA", "ヴェラ": "VERA", "ユリ": "YURI", "ソラ": "SORA", "ミロ": "MILO", "イネス": "INES", "ハル": "HARU", "アキ": "AKI", "ノア": "NOAH", "エリン": "ERIN", "ダリア": "DALIA", "テオ": "THEO" };

  // ---- 台詞(一般) ----
  V.LINES = {
    greet: {
      "乗客": ["エリュシオン行きです。", "移住の手続きに来ました。", "今日の便で上がります。", "これで地上ともお別れです。"],
      "乗員": ["第12便の乗員です。訓練に入ります。", "整備区画を抜けて発射台へ。", "乗員の入構です。"],
      "地上職員": ["整備の交代です。", "燃料区画の当番です。", "清掃に入ります。"]
    },
    flaw: {
      expired: ["え、期限? …昨日まで使えたのに。", "更新の窓口が閉まっていたんです。"],
      status: ["判定は…分かっています。でも、どうしても。", "INVALID でも働けると聞きました。"],
      permit: ["許可証は今朝もらったはずで…", "これは同僚のものです。間違えました。"],
      genome: ["機械の故障でしょう。", "…何かの間違いです。"],
      height: ["靴のせいですよ。", "最近、背が伸びたんです。"],
      ticketName: ["家族の券と取り違えたようです。", "旧姓のままなんです。"],
      ticketDate: ["日付? そんなはずは…", "昨日の便に乗り遅れたんです。"],
      seal: ["先週、窓口でもらった券です。", "印章なんて見ていませんでした。"],
      heart: ["緊張しているだけです。", "…持病のことは書いていません。"],
      hair: ["今朝、自宅で抜いた毛です。", "…はさみで切りました。"],
      mass: ["朝食を食べすぎて。", "量り方がおかしいのでは。"],
      xray: ["…それは、薬です。", "触らないでください。"]
    },
    noFlaw: ["…何か問題でも?", "それが何か?", "書いてある通りです。"],
    approved: ["ありがとう。", "…よかった。", "行ってきます。"],
    denied: ["そんな…", "また来ます。", "…分かりました。"],
    limited: ["整備区画ですね。了解。", "いつもの場所です。"],
    detained: ["待って、話を聞いて!", "離せ!", "…娘がいるんです。"]
  };

  // ---- 物語の申請者(試作版の11人) ----
  // 指定のない値は applicant.js が自然な値で埋める。欠点は書類と身体から自動で導く。
  V.SCRIPTED = {
    1: [
      { at: 0, id: "rina", first: "リナ", last: "オカフォー", latin: "RINA OKAFOR", sex: "女", role: "乗客", seed: 101,
        greet: ["おはようございます。エリュシオン行きの、最初の便です。", "母が先に上で待っているんです。"],
        tutorial: true },
      { at: 2, id: "tam", first: "タム", last: "ベルグ", latin: "TAM BERG", sex: "男", role: "乗客", seed: 202,
        expiry: "2089.04.30",
        greet: ["お願いします。今日の便に乗らないと、もう席がないんです。"],
        replies: { expired: "昨日までは有効だったんです! たった一日じゃないですか。" } },
      { at: 3, id: "walter", first: "ウォルター", last: "クライン", latin: "WALTER KLEIN", sex: "男", role: "地上職員", seed: 303, status: "INVALID",
        permit: { zone: "清掃区画" },
        greet: ["清掃のクラインです。いつもの区画へ。", "…上には行きませんよ。行けませんから。"] },
      { at: 5, id: "kai", first: "カイ", last: "ヴェルナー", latin: "KAI WERNER", sex: "男", role: "乗客", seed: 404,
        predH: [176, 182], actualH: 188, sampleMut: [5, 11],
        greet: ["ヴェルナーです。妹を残していくのは心苦しいけど。"],
        replies: { genome: "…機械がおかしいんだ。もう一度採ってくれ。", height: "靴だよ。厚底なんだ。" } }
    ],
    2: [
      { at: 0, id: "mira", first: "ミラ", last: "ソーン", latin: "MIRA THORNE", sex: "女", role: "乗客", seed: 505,
        ticket: { seal: "E-11" },
        greet: ["券は先週、本局の窓口でもらいました。"],
        replies: { seal: "先週もらったばかりの券なのに! 窓口は何も言わなかった。" } },
      { at: 2, id: "plum", first: "イーサン", last: "プラム", latin: "ETHAN PLUM", sex: "男", role: "乗客", seed: 606,
        heart: "irregular", med: { cond: "発作性心房細動(治療済)" },
        greet: ["医師のプラムです。上の診療所に赴任します。", "心拍が気になるなら、記録を持ってきました。"] },
      { at: 3, id: "hallow", first: "ジェイ", last: "ハロウ", latin: "JAY HALLOW", sex: "男", role: "乗員", seed: 707, hand: "左",
        greet: ["航法士のハロウです。今日から最終便の訓練区画へ。", "(差し出したペンを、迷ってから右手で受け取った)"] },
      { at: 5, id: "broker", first: "サイ", last: "マロ", latin: "SAI MARO", sex: "男", role: "乗客", seed: 808,
        envelope: true,
        greet: ["書類は全部そろってますよ。", "それと…これは忘れ物です。お子さんの薬代にでも。"] }
    ],
    3: [
      { at: 0, id: "nora", first: "ノラ", last: "ヴェルナー", latin: "NORA WERNER", sex: "女", role: "乗客", seed: 909,
        greet: ["ヴェルナーです。兄が、おととい、ここを通ったはずなんです。"] },
      { at: 2, id: "sol", first: "ソル", last: "アデイェミ", latin: "SOL ADEYEMI", sex: "男", role: "乗客", seed: 1010,
        hair: "cut", xray: "pouch", massDiff: 0.9,
        greet: ["アデイェミです。毛髪は持ってきました。今朝、自宅で抜いたものです。"],
        replies: { hair: "…抜いたって言ったでしょう。", xray: "それは常備薬だ。触らないでくれ。", mass: "朝食のせいだ。" } },
      { at: 4, id: "hallow2", first: "ジェイ", last: "ハロウ", latin: "JAY HALLOW", sex: "男", role: "乗員", seed: 707, hand: "左", fresh: 0.8,
        greet: ["また会いましたね。ハロウです。", "今朝は少し急いで来たもので。"] }
    ]
  };

  // ノラの台詞は、カイの判定で変わる
  V.noraLine = verdict => ({
    detain: "兄は、ここで連れて行かれたと聞きました。どこにいるんですか。",
    deny: "兄は帰ってきました。何も話してくれません。私だけでも、上に行けと。",
    limit: "兄は、ここで止められたと聞きました。",
    approve: "兄は無事に飛んだそうです。…ありがとうございました。"
  })[verdict] || "兄のことを、何か知りませんか。";

  // 夜の知らせ(判定に応じて)
  V.nightNews = (day, flags) => {
    const out = [];
    if (day === 1) out.push(flags.kai === "detain" ? "第7ゲートで、身長と遺伝子を偽った男が拘束された。" : flags.kai === "approve" ? "ヴェルナー氏は定刻の便で軌道へ向かった。" : "第7ゲートは今日も混雑した。");
    if (day === 2) out.push(flags.bribe ? "封筒の中には、薬3週間分の金額が入っていた。" : flags.envelopeReturned ? "封筒は、返した。" : "");
    if (day === 3) out.push("今夜、最終便の乗員名簿が公開された。");
    return out.filter(Boolean);
  };

  V.MANIFEST = [
    ["船長", "イルゼ・ヴァルガ"],
    ["副操縦士", "マテオ・リンド"],
    ["航法士", "ジェイ・ハロウ"],
    ["医務", "ネイサン・コール"],
    ["機関士", "ユナ・カトウ"]
  ];
})();
