// 全球五大洲 - 完整国家与全量省市数据库
export const worldLocations = [
  {
    continent: "亚洲 (Asia)",
    regions: [
      {
        name: "东亚",
        countries: [
          {
            name: "中国",
            provinces: [
              { name: "北京市", cities: ["东城区", "西城区", "朝阳区", "海淀区", "丰台区", "石景山区", "通州区", "昌平区", "大兴区", "顺义区", "房山区"] },
              { name: "上海市", cities: ["黄浦区", "徐汇区", "长宁区", "静安区", "普陀区", "虹口区", "杨浦区", "浦东新区", "闵行区", "宝山区", "嘉定区", "松江区"] },
              { name: "天津市", cities: ["和平区", "河东区", "河西区", "南开区", "河北区", "红桥区", "滨海新区", "武清区", "西青区"] },
              { name: "重庆市", cities: ["渝中区", "江北区", "渝北区", "南岸区", "九龙坡区", "沙坪坝区", "万州区", "涪陵区", "永川区"] },
              { name: "湖南省", cities: ["长沙市", "株洲市", "湘潭市", "衡阳市", "邵阳市", "岳阳市", "常德市", "张家界市", "益阳市", "郴州市", "永州市", "怀化市", "娄底市", "湘西土家族苗族自治州"] },
              { name: "广东省", cities: ["广州市", "深圳市", "珠海市", "汕头市", "佛山市", "韶关市", "湛江市", "肇庆市", "江门市", "茂名市", "惠州市", "梅州市", "汕尾市", "河源市", "阳江市", "清远市", "东莞市", "中山市", "潮州市", "揭阳市", "云浮市"] },
              { name: "浙江省", cities: ["杭州市", "宁波市", "温州市", "嘉兴市", "湖州市", "绍兴市", "金华市", "衢州市", "舟山市", "台州市", "丽水市"] },
              { name: "江苏省", cities: ["南京市", "无锡市", "徐州市", "常州市", "苏州市", "南通市", "连云港市", "淮安市", "盐城市", "扬州市", "镇江市", "泰州市", "宿迁市"] },
              { name: "四川省", cities: ["成都市", "自贡市", "攀枝花市", "泸州市", "德阳市", "绵阳市", "广元市", "遂宁市", "内江市", "乐山市", "南充市", "眉山市", "宜宾市", "广安市", "达州市", "雅安市", "巴中市", "资阳市", "阿坝藏族羌族自治州", "甘孜藏族自治州", "凉山彝族自治州"] },
              { name: "湖北省", cities: ["武汉市", "黄石市", "十堰市", "宜昌市", "襄阳市", "鄂州市", "荆门市", "孝感市", "荆州市", "黄冈市", "咸宁市", "随州市", "恩施土家族苗族自治州", "仙桃市", "天门市", "潜江市", "神农架林区"] },
              { name: "山东省", cities: ["济南市", "青岛市", "淄博市", "枣庄市", "东营市", "烟台市", "潍坊市", "济宁市", "泰安市", "威海市", "日照市", "临沂市", "德州市", "聊城市", "滨州市", "菏泽市"] },
              { name: "河南省", cities: ["郑州市", "开封市", "洛阳市", "平顶山市", "安阳市", "鹤壁市", "新乡市", "焦作市", "濮阳市", "许昌市", "漯河市", "三门峡市", "南阳市", "商丘市", "信阳市", "周口市", "驻马店市", "济源市"] },
              { name: "福建省", cities: ["福州市", "厦门市", "莆田市", "三明市", "泉州市", "漳州市", "南平市", "龙岩市", "宁德市"] },
              { name: "安徽省", cities: ["合肥市", "芜湖市", "蚌埠市", "淮南市", "马鞍山市", "淮北市", "铜陵市", "安庆市", "黄山市", "滁州市", "阜阳市", "宿州市", "六安市", "亳州市", "池州市", "宣城市"] },
              { name: "陕西省", cities: ["西安市", "铜川市", "宝鸡市", "咸阳市", "渭南市", "延安市", "汉中市", "榆林市", "安康市", "商洛市"] },
              { name: "河北省", cities: ["石家庄市", "唐山市", "秦皇岛市", "邯郸市", "邢台市", "保定市", "张家口市", "承德市", "沧州市", "廊坊市", "衡水市", "雄安新区"] },
              { name: "辽宁省", cities: ["沈阳市", "大连市", "鞍山市", "抚顺市", "本溪市", "丹东市", "锦州市", "营口市", "阜新市", "辽阳市", "盘锦市", "铁岭市", "朝阳市", "葫芦岛市"] },
              { name: "吉林省", cities: ["长春市", "吉林市", "四平市", "辽源市", "通化市", "白山市", "松原市", "白城市", "延边朝鲜族自治州"] },
              { name: "黑龙江省", cities: ["哈尔滨市", "齐齐哈尔市", "鸡西市", "鹤岗市", "双鸭山市", "大庆市", "伊春市", "佳木斯市", "七台河市", "牡丹江市", "黑河市", "绥化市", "大兴安岭地区"] },
              { name: "江西省", cities: ["南昌市", "景德镇市", "萍乡市", "九江市", "新余市", "鹰潭市", "赣州市", "吉安市", "宜春市", "抚州市", "上饶市"] },
              { name: "广西壮族自治区", cities: ["南宁市", "柳州市", "桂林市", "梧州市", "北海市", "防城港市", "钦州市", "贵港市", "玉林市", "百色市", "贺州市", "河池市", "来宾市", "崇左市"] },
              { name: "海南省", cities: ["海口市", "三亚市", "三沙市", "儋州市", "琼海市", "文昌市", "万宁市", "东方市", "陵水黎族自治县"] },
              { name: "贵州省", cities: ["贵阳市", "六盘水市", "遵义市", "安顺市", "毕节市", "铜仁市", "黔西南布依族苗族自治州", "黔东南苗族侗族自治州", "黔南布依族苗族自治州"] },
              { name: "云南省", cities: ["昆明市", "曲靖市", "玉溪市", "保山市", "昭通市", "丽江市", "普洱市", "临沧市", "楚雄彝族自治州", "红河哈尼族彝族自治州", "文山壮族苗族自治州", "西双版纳傣族自治州", "大理白族自治州", "德宏傣族景颇族自治州", "怒江傈僳族自治州", "迪庆藏族自治州"] },
              { name: "西藏自治区", cities: ["拉萨市", "日喀则市", "昌都市", "林芝市", "山南市", "那曲市", "阿里地区"] },
              { name: "甘肃省", cities: ["兰州市", "嘉峪关市", "金昌市", "白银市", "天水市", "武威市", "张掖市", "平凉市", "酒泉市", "庆阳市", "定西市", "陇南市", "临夏回族自治州", "甘南藏族自治州"] },
              { name: "青海省", cities: ["西宁市", "海东市", "海北藏族自治州", "黄南藏族自治州", "海南藏族自治州", "果洛藏族自治州", "玉树藏族自治州", "海西蒙古族藏族自治州", "格尔木市"] },
              { name: "宁夏回族自治区", cities: ["银川市", "石嘴山市", "吴忠市", "固原市", "中卫市"] },
              { name: "新疆维吾尔自治区", cities: ["乌鲁木齐市", "克拉玛依市", "吐鲁番市", "哈密市", "昌吉回族自治州", "博尔塔拉蒙古自治州", "巴音郭楞蒙古自治州", "阿克苏地区", "克孜勒苏柯尔克孜自治州", "喀什地区", "和田地区", "伊犁哈萨克自治州", "塔城地区", "阿勒泰地区", "石河子市"] },
              { name: "内蒙古自治区", cities: ["呼和浩特市", "包头市", "乌海市", "赤峰市", "通辽市", "鄂尔多斯市", "呼伦贝尔市", "巴彦淖尔市", "乌兰察布市", "兴安盟", "锡林郭勒盟", "阿拉善盟"] },
              { name: "山西省", cities: ["太原市", "大同市", "阳泉市", "长治市", "晋城市", "朔州市", "晋中市", "运城市", "忻州市", "临汾市", "吕梁市"] },
              { name: "香港特别行政区", cities: ["中西区", "湾仔区", "东区", "南区", "油尖旺区", "深水埗区", "九龙城区", "沙田区", "离岛区"] },
              { name: "澳门特别行政区", cities: ["花地玛堂区", "圣安多尼堂区", "大堂区", "望德堂区", "风顺堂区", "嘉模堂区", "路氹城"] },
              { name: "台湾省", cities: ["台北市", "新北市", "桃园市", "台中市", "台南市", "高雄市", "基隆市", "新竹市", "嘉义市", "花莲县", "澎湖县"] }
            ]
          },
          {
            name: "日本",
            provinces: [
              { name: "关东地方", cities: ["东京 (Tokyo)", "新宿", "涩谷", "横滨 (Yokohama)", "千叶", "埼玉", "镰仓"] },
              { name: "近畿地方", cities: ["大阪 (Osaka)", "京都 (Kyoto)", "神户 (Kobe)", "奈良 (Nara)"] },
              { name: "中部地方", cities: ["名古屋 (Nagoya)", "金泽", "静冈", "长野", "轻井泽"] },
              { name: "北海道及东北", cities: ["札幌 (Sapporo)", "小樽 (Otaru)", "函馆", "仙台 (Sendai)", "青森"] },
              { name: "九州及冲绳", cities: ["福冈 (Fukuoka)", "熊本 (Kumamoto)", "长崎", "鹿儿岛", "冲绳 (那霸)"] }
            ]
          },
          {
            name: "韩国",
            provinces: [
              { name: "首都圈", cities: ["首尔 (Seoul)", "仁川 (Incheon)", "水原", "城南 (盆唐)"] },
              { name: "岭南与湖南地区", cities: ["釜山 (Busan)", "大邱 (Daegu)", "光州", "蔚山", "庆州"] },
              { name: "道与离岛", cities: ["济州岛 (Jeju)", "江原道 (江陵)", "忠清道 (大田)"] }
            ]
          },
          { name: "蒙古", cities: ["乌兰巴托 (Ulaanbaatar)", "额尔登特", "达尔汗"] },
          { name: "朝鲜", cities: ["平壤 (Pyongyang)", "开城", "新义州", "南浦"] }
        ]
      },
      {
        name: "东南亚",
        countries: [
          {
            name: "泰国",
            provinces: [
              { name: "中部与曼谷区", cities: ["曼谷 (Bangkok)", "大城", "芭提雅 (Pattaya)", "华欣"] },
              { name: "北部与安达曼海", cities: ["清迈 (Chiang Mai)", "清莱", "普吉岛 (Phuket)", "苏梅岛", "甲米"] }
            ]
          },
          {
            name: "马来西亚",
            provinces: [
              { name: "西马 (半岛)", cities: ["吉隆坡 (Kuala Lumpur)", "槟城 (George Town)", "新山", "马六甲", "怡保"] },
              { name: "东马 (沙巴/砂拉越)", cities: ["亚庇 (Kota Kinabalu)", "古晋 (Kuching)", "仙本那"] }
            ]
          },
          { name: "新加坡", cities: ["新加坡 (Singapore)"] },
          {
            name: "印度尼西亚",
            provinces: [
              { name: "爪哇与巴厘", cities: ["雅加达 (Jakarta)", "巴厘岛 (Bali)", "泗水", "万隆", "日惹"] },
              { name: "苏门答腊与外岛", cities: ["棉兰", "龙目岛", "科莫多岛", "巴淡岛"] }
            ]
          },
          {
            name: "越南",
            provinces: [
              { name: "北部地区", cities: ["河内 (Hanoi)", "下龙湾", "海防"] },
              { name: "中部与南部", cities: ["胡志明市 (Saigon)", "岘港 (Da Nang)", "芽庄", "会安", "富国岛"] }
            ]
          },
          {
            name: "菲律宾",
            cities: ["马尼拉 (Manila)", "宿务 (Cebu)", "长滩岛 (Boracay)", "达沃", "巴拉望 (爱妮岛)"]
          },
          { name: "柬埔寨", cities: ["金边 (Phnom Penh)", "暹粒 (吴哥窟)", "西哈努克港"] },
          { name: "老挝", cities: ["万象 (Vientiane)", "琅勃拉邦 (Luang Prabang)", "万荣"] },
          { name: "缅甸", cities: ["仰光 (Yangon)", "曼德勒 (Mandalay)", "蒲甘 (Bagan)", "内比都"] },
          { name: "文莱", cities: ["斯里巴加湾市 (Bandar Seri Begawan)"] },
          { name: "东帝汶", cities: ["帝力 (Dili)"] }
        ]
      },
      {
        name: "南亚",
        countries: [
          {
            name: "印度",
            provinces: [
              { name: "北部与德里", cities: ["新德里 (New Delhi)", "阿格拉 (泰姬陵)", "斋浦尔 (Jaipur)", "瓦拉纳西"] },
              { name: "西部与南部", cities: ["孟买 (Mumbai)", "班加罗尔 (Bangalore)", "金奈", "加尔各答", "果阿 (Goa)"] }
            ]
          },
          { name: "巴基斯坦", cities: ["伊斯兰堡 (Islamabad)", "卡拉奇 (Karachi)", "拉合尔", "拉瓦尔品第"] },
          { name: "孟加拉国", cities: ["达卡 (Dhaka)", "吉大港", "库尔纳"] },
          { name: "斯里兰卡", cities: ["科伦坡 (Colombo)", "康提 (Kandy)", "加勒 (Galle)", "尼甘布"] },
          { name: "尼泊尔", cities: ["加德满都 (Kathmandu)", "博卡拉 (Pokhara)", "奇特旺"] },
          { name: "马尔代夫", cities: ["马累 (Male)", "阿里环礁", "马累国际机场岛"] },
          { name: "不丹", cities: ["廷布 (Thimphu)", "帕罗 (Paro)", "普纳卡"] }
        ]
      },
      {
        name: "中亚",
        countries: [
          { name: "哈萨克斯坦", cities: ["阿斯塔纳 (Astana)", "阿拉木图 (Almaty)", "奇姆肯特"] },
          { name: "乌兹别克斯坦", cities: ["塔什干 (Tashkent)", "撒马尔罕 (Samarkand)", "布哈拉"] },
          { name: "土库曼斯坦", cities: ["阿什哈巴德 (Ashgabat)", "土库曼纳巴德"] },
          { name: "吉尔吉斯斯坦", cities: ["比什凯克 (Bishkek)", "奥什", "伊塞克湖"] },
          { name: "塔吉克斯坦", cities: ["杜尚别 (Dushanbe)", "苦盏"] }
        ]
      },
      {
        name: "西亚",
        countries: [
          {
            name: "阿联酋",
            cities: ["迪拜 (Dubai)", "阿布扎比 (Abu Dhabi)", "沙迦 (Sharjah)", "阿治曼", "拉斯海马"]
          },
          {
            name: "沙特阿拉伯",
            cities: ["利雅得 (Riyadh)", "吉达 (Jeddah)", "麦加 (Mecca)", "麦地那 (Medina)", "达曼"]
          },
          {
            name: "土耳其",
            cities: ["伊斯坦布尔 (Istanbul)", "卡帕多奇亚", "安卡拉 (Ankara)", "安塔利亚", "伊兹密尔", "费特希耶"]
          },
          { name: "卡塔尔", cities: ["多哈 (Doha)", "路萨尔 (Lusail)", "艾勒扬"] },
          { name: "以色列", cities: ["耶路撒冷 (Jerusalem)", "特拉维夫 (Tel Aviv)", "海法", "死海地区"] },
          { name: "伊朗", cities: ["德黑兰 (Tehran)", "伊斯法罕 (Isfahan)", "设拉子 (Shiraz)", "亚兹德"] },
          { name: "伊拉克", cities: ["巴格达 (Baghdad)", "埃尔比勒", "巴士拉", "纳杰夫"] },
          { name: "科威特", cities: ["科威特城 (Kuwait City)"] },
          { name: "阿曼", cities: ["马斯喀特 (Muscat)", "塞拉莱", "尼兹瓦"] },
          { name: "约旦", cities: ["安曼 (Amman)", "佩特拉 (Petra)", "亚喀巴", "瓦迪拉姆"] },
          { name: "黎巴嫩", cities: ["贝鲁特 (Beirut)", "朱拜勒", "的黎波里"] },
          { name: "叙利亚", cities: ["大马士革 (Damascus)", "阿勒颇", "霍姆斯"] },
          { name: "阿富汗", cities: ["喀布尔 (Kabul)", "坎大哈", "赫拉特"] },
          { name: "巴林", cities: ["麦纳麦 (Manama)"] },
          { name: "也门", cities: ["萨那 (Sanaa)", "亚丁 (Aden)"] },
          { name: "格鲁吉亚", cities: ["第比利斯 (Tbilisi)", "巴统 (Batumi)", "卡兹别克"] },
          { name: "亚美尼亚", cities: ["埃里温 (Yerevan)", "塞凡湖"] },
          { name: "阿塞拜疆", cities: ["巴库 (Baku)", "占贾"] },
          { name: "塞浦路斯", cities: ["尼科西亚 (Nicosia)", "利马索尔", "拉纳卡"] },
          { name: "巴勒斯坦", cities: ["拉姆安拉", "伯利恒", "加沙"] }
        ]
      }
    ]
  },
  {
    continent: "欧洲 (Europe)",
    regions: [
      {
        name: "西欧",
        countries: [
          {
            name: "英国",
            provinces: [
              { name: "英格兰", cities: ["伦敦 (London)", "曼彻斯特 (Manchester)", "伯明翰", "利物浦", "牛津", "剑桥", "布里斯托", "约克"] },
              { name: "苏格兰与其它", cities: ["爱丁堡 (Edinburgh)", "格拉斯哥 (Glasgow)", "加的夫 (Cardiff)", "贝尔法斯特 (Belfast)"] }
            ]
          },
          {
            name: "法国",
            provinces: [
              { name: "大巴黎区", cities: ["巴黎 (Paris)", "凡尔赛 (Versailles)", "枫丹白露"] },
              { name: "南部及沿海", cities: ["尼斯 (Nice)", "戛纳 (Cannes)", "马赛 (Marseille)", "里昂 (Lyon)", "波尔多 (Bordeaux)", "斯特拉斯堡", "图卢兹"] }
            ]
          },
          {
            name: "荷兰",
            cities: ["阿姆斯特丹 (Amsterdam)", "鹿特丹 (Rotterdam)", "海牙 (The Hague)", "乌得勒支", "羊角村"]
          },
          {
            name: "比利时",
            cities: ["布鲁塞尔 (Brussels)", "布鲁日 (Bruges)", "安特卫普 (Antwerp)", "根特"]
          },
          { name: "爱尔兰", cities: ["都柏林 (Dublin)", "科克 (Cork)", "高威 (Galway)"] },
          { name: "卢森堡", cities: ["卢森堡市 (Luxembourg City)"] },
          { name: "摩纳哥", cities: ["蒙特卡洛 (Monte Carlo)", "摩纳哥城"] }
        ]
      },
      {
        name: "中欧",
        countries: [
          {
            name: "德国",
            provinces: [
              { name: "北部与东部", cities: ["柏林 (Berlin)", "汉堡 (Hamburg)", "汉诺威", "莱比锡", "德累斯顿"] },
              { name: "南部与西部", cities: ["慕尼黑 (Munich)", "法兰克福 (Frankfurt)", "科隆 (Cologne)", "杜塞尔多夫", "斯图加特 (Stuttgart)", "纽伦堡", "海德堡"] }
            ]
          },
          {
            name: "瑞士",
            cities: ["苏黎世 (Zurich)", "日内瓦 (Geneva)", "因特拉肯 (Interlaken)", "琉森 (Luzern)", "伯尔尼 (Bern)", "巴塞尔", "采尔马特"]
          },
          {
            name: "奥地利",
            cities: ["维也纳 (Vienna)", "萨尔茨堡 (Salzburg)", "因斯布鲁克 (Innsbruck)", "哈尔施塔特", "格拉茨"]
          },
          { name: "波兰", cities: ["华沙 (Warsaw)", "克拉科夫 (Krakow)", "弗罗茨瓦夫", "格但斯克"] },
          { name: "捷克", cities: ["布拉格 (Prague)", "CK小镇 (克鲁姆洛夫)", "布尔诺", "卡罗维发利"] },
          { name: "匈牙利", cities: ["布达佩斯 (Budapest)", "塞格德", "埃格尔"] },
          { name: "斯洛伐克", cities: ["布拉迪斯拉发 (Bratislava)", "科希策"] },
          { name: "列支敦士登", cities: ["瓦杜兹 (Vaduz)"] }
        ]
      },
      {
        name: "南欧",
        countries: [
          {
            name: "意大利",
            provinces: [
              { name: "北部地区", cities: ["米兰 (Milan)", "威尼斯 (Venice)", "佛罗伦萨 (Florence)", "都灵", "热那亚", "博洛尼亚", "科莫湖"] },
              { name: "中部与南部", cities: ["罗马 (Rome)", "那不勒斯 (Naples)", "阿玛菲海岸", "西西里岛 (巴勒莫)", "五渔村", "梵蒂冈"] }
            ]
          },
          {
            name: "西班牙",
            provinces: [
              { name: "中部与加泰罗尼亚", cities: ["马德里 (Madrid)", "巴塞罗那 (Barcelona)", "托莱多", "萨拉戈萨"] },
              { name: "安达卢西亚与海岛", cities: ["塞维利亚 (Seville)", "格拉纳达 (Granada)", "瓦伦西亚", "马拉加", "马略卡岛", "伊比萨岛"] }
            ]
          },
          { name: "葡萄牙", cities: ["里斯本 (Lisbon)", "波尔图 (Porto)", "辛特拉", "法鲁", "马德拉群岛"] },
          { name: "希腊", cities: ["雅典 (Athens)", "圣托里尼岛 (Santorini)", "米克诺斯岛", "罗德岛", "克里特岛", "扎金索斯"] },
          { name: "克罗地亚", cities: ["杜布罗夫尼克 (Dubrovnik)", "萨格勒布 (Zagreb)", "斯普利特", "十六湖国家公园"] },
          { name: "塞尔维亚", cities: ["贝尔格莱德 (Belgrade)", "诺维萨德", "尼什"] },
          { name: "罗马尼亚", cities: ["布加勒斯特 (Bucharest)", "布拉索夫 (吸血鬼城堡)", "克卢日-纳波卡"] },
          { name: "保加利亚", cities: ["索非亚 (Sofia)", "普罗夫迪夫", "瓦尔纳"] },
          { name: "斯洛文尼亚", cities: ["卢布尔雅那 (Ljubljana)", "布莱德湖", "马里博尔"] },
          { name: "马耳他", cities: ["瓦莱塔 (Valletta)", "斯利马", "戈佐岛"] },
          { name: "黑山", cities: ["科托尔 (Kotor)", "波德戈里察", "布德瓦"] },
          { name: "阿尔巴尼亚", cities: ["地拉那 (Tirana)", "萨兰达", "都拉斯"] },
          { name: "北马其顿", cities: ["斯科普里 (Skopje)", "奥赫里德"] },
          { name: "波斯尼亚和黑塞哥维那", cities: ["萨拉热窝 (Sarajevo)", "莫斯塔尔 (Mostar)"] },
          { name: "圣马力诺", cities: ["圣马力诺城"] },
          { name: "安道尔", cities: ["安道尔城 (Andorra la Vella)"] },
          { name: "梵蒂冈", cities: ["梵蒂冈城 (Vatican City)"] }
        ]
      },
      {
        name: "北欧",
        countries: [
          { name: "挪威", cities: ["奥斯陆 (Oslo)", "卑尔根 (Bergen)", "特罗姆瑟 (极光之城)", "斯塔万格", "罗弗敦群岛"] },
          { name: "冰岛", cities: ["雷克雅未克 (Reykjavik)", "阿克雷里", "维克小镇", "蓝湖地区"] },
          { name: "芬兰", cities: ["赫尔辛基 (Helsinki)", "罗瓦涅米 (圣诞老人村)", "坦佩雷", "图尔库", "萨利色尔卡"] },
          { name: "瑞典", cities: ["斯德哥尔摩 (Stockholm)", "哥德堡 (Gothenburg)", "马尔默", "阿比斯库", "乌普萨拉"] },
          { name: "丹麦", cities: ["哥本哈根 (Copenhagen)", "欧登塞 (安徒生故乡)", "奥胡斯", "比隆 (乐高乐园)"] },
          { name: "法罗群岛(丹)", cities: ["托尔斯港 (Torshavn)", "克拉克斯维克"] }
        ]
      },
      {
        name: "东欧",
        countries: [
          {
            name: "俄罗斯",
            cities: ["莫斯科 (Moscow)", "圣彼得堡 (Saint Petersburg)", "海参崴 (符拉迪沃斯托克)", "索契", "贝加尔湖 (伊尔库茨克)", "喀山", "新西伯利亚"]
          },
          { name: "乌克兰", cities: ["基辅 (Kyiv)", "利沃夫 (Lviv)", "敖德萨 (Odesa)", "哈尔科夫"] },
          { name: "白俄罗斯", cities: ["明斯克 (Minsk)", "布列斯特", "格罗德诺"] },
          { name: "立陶宛", cities: ["维尔纽斯 (Vilnius)", "考纳斯", "克莱佩达"] },
          { name: "拉脱维亚", cities: ["里加 (Riga)", "尤尔马拉", "陶格夫匹尔斯"] },
          { name: "爱沙尼亚", cities: ["塔林 (Tallinn)", "塔尔图", "帕尔努"] },
          { name: "摩尔多瓦", cities: ["基希讷乌 (Chisinau)", "蒂拉斯波尔"] }
        ]
      }
    ]
  },
  {
    continent: "美洲 (Americas)",
    regions: [
      {
        name: "北美洲 - 北美",
        countries: [
          {
            name: "美国",
            provinces: [
              { name: "加利福尼亚州 (CA)", cities: ["洛杉矶 (Los Angeles)", "旧金山 (San Francisco)", "硅谷 (Silicon Valley)", "圣地亚哥 (San Diego)", "尔湾", "圣何塞"] },
              { name: "纽约州与东部", cities: ["纽约市 (New York City)", "波士顿 (Boston)", "华盛顿哥伦比亚特区 (DC)", "费城 (Philadelphia)", "水牛城"] },
              { name: "华盛顿州与西部", cities: ["西雅图 (Seattle)", "波特兰 (Portland)", "拉斯维加斯 (Las Vegas)", "盐湖城", "丹佛 (Denver)"] },
              { name: "德克萨斯州 (TX)", cities: ["休斯敦 (Houston)", "奥斯汀 (Austin)", "达拉斯 (Dallas)", "圣安东尼奥"] },
              { name: "伊利诺伊与中部", cities: ["芝加哥 (Chicago)", "底特律", "明尼阿波利斯", "克利夫兰", "印第安纳波利斯"] },
              { name: "佛罗里达与南部", cities: ["迈阿密 (Miami)", "奥兰多 (Orlando)", "亚特兰大 (Atlanta)", "坦帕", "新奥尔良"] },
              { name: "夏威夷与离岛", cities: ["檀香山/火奴鲁鲁 (Honolulu)", "大岛/希洛", "茂宜岛", "安克雷奇 (阿拉斯加)"] }
            ]
          },
          {
            name: "加拿大",
            provinces: [
              { name: "安大略省", cities: ["多伦多 (Toronto)", "渥太华 (Ottawa)", "密西沙加", "汉密尔顿", "伦敦", "尼亚加拉瀑布城"] },
              { name: "不列颠哥伦比亚省", cities: ["温哥华 (Vancouver)", "维多利亚 (Victoria)", "列治文 (Richmond)", "本拿比", "惠斯勒"] },
              { name: "魁北克省", cities: ["蒙特利尔 (Montreal)", "魁北克市 (Quebec City)", "拉瓦勒", "加蒂诺"] },
              { name: "阿尔伯塔省及其他", cities: ["卡尔加里 (Calgary)", "埃德蒙顿 (Edmonton)", "班夫 (Banff)", "温尼伯", "哈利法克斯", "黄刀镇 (极光)"] }
            ]
          },
          {
            name: "墨西哥",
            cities: ["墨西哥城 (Mexico City)", "坎昆 (Cancun)", "瓜达拉哈拉", "蒙特雷", "提华纳", "普埃布拉", "瓦哈卡"]
          },
          { name: "格陵兰(丹)", cities: ["努克 (Nuuk)", "伊卢利萨特", "西斯米特"] }
        ]
      },
      {
        name: "中美洲",
        countries: [
          { name: "哥斯达黎加", cities: ["圣何塞 (San Jose)", "阿拉胡埃拉", "利蒙", "蓬塔雷纳斯"] },
          { name: "巴拿马", cities: ["巴拿马城 (Panama City)", "科隆", "戴维"] },
          { name: "危地马拉", cities: ["危地马拉城 (Guatemala City)", "安提瓜", "阿蒂特兰湖"] },
          { name: "伯利兹", cities: ["伯利兹城", "贝尔莫潘 (Belmopan)", "圣佩德罗"] },
          { name: "萨尔瓦多", cities: ["圣萨尔瓦多 (San Salvador)", "圣安娜"] },
          { name: "洪都拉斯", cities: ["特古西加尔巴 (Tegucigalpa)", "圣佩德罗苏拉", "罗阿坦岛"] },
          { name: "尼加拉瓜", cities: ["马那瓜 (Managua)", "格拉纳达", "莱昂"] }
        ]
      },
      {
        name: "加勒比海地区",
        countries: [
          { name: "古巴", cities: ["哈瓦那 (Havana)", "巴拉德罗 (Varadero)", "特立尼达", "圣地亚哥"] },
          { name: "巴哈马", cities: ["拿骚 (Nassau)", "天堂岛", "自由港"] },
          { name: "波多黎各(美)", cities: ["圣胡安 (San Juan)", "庞塞", "法哈多"] },
          { name: "多米尼加共和国", cities: ["圣多明各 (Santo Domingo)", "蓬塔卡纳 (Punta Cana)"] },
          { name: "牙买加", cities: ["金斯敦 (Kingston)", "蒙特哥贝", "八条河"] },
          { name: "开曼群岛(英)", cities: ["乔治城 (George Town)", "大开曼"] },
          { name: "百慕大(英)", cities: ["哈密尔顿 (Hamilton)", "圣乔治"] },
          { name: "维尔京群岛(英/美)", cities: ["夏洛特阿马利亚", "罗德城", "圣托马斯岛"] },
          { name: "巴巴多斯", cities: ["布里奇顿 (Bridgetown)"] },
          { name: "海地", cities: ["太子港 (Port-au-Prince)", "海地角"] },
          { name: "特立尼达和多巴哥", cities: ["西班牙港 (Port of Spain)", "圣费尔南多"] },
          { name: "阿鲁巴(荷)", cities: ["奥拉涅斯塔德 (Oranjestad)"] },
          { name: "圣卢西亚", cities: ["卡斯特里 (Castries)", "苏弗里耶尔"] },
          { name: "荷属/法属安的列斯", cities: ["威廉斯塔德 (库拉索)", "圣马丁岛", "马提尼克"] }
        ]
      },
      {
        name: "南美洲",
        countries: [
          {
            name: "巴西",
            provinces: [
              { name: "东南核心区", cities: ["圣保罗 (Sao Paulo)", "里约热内卢 (Rio de Janeiro)", "贝洛奥里藏特", "坎皮纳斯"] },
              { name: "联邦区及其他", cities: ["巴西利亚 (Brasilia)", "萨尔瓦多 (Salvador)", "福塔莱萨", "库里蒂巴", "马瑙斯 (亚马逊)"] }
            ]
          },
          {
            name: "阿根廷",
            cities: ["布宜诺斯艾利斯 (Buenos Aires)", "科尔多瓦", "罗萨里奥", "门多萨 (酒庄)", "乌斯怀亚 (世界尽头)", "巴里洛切", "伊瓜苏港"]
          },
          { name: "智利", cities: ["圣地亚哥 (Santiago)", "瓦尔帕莱索", "复活节岛 (Easter Island)", "阿塔卡马沙漠", "蓬塔阿雷纳斯"] },
          { name: "秘鲁", cities: ["利马 (Lima)", "库斯科 (Cusco)", "马丘比丘 (Machu Picchu)", "阿雷基帕", "普诺 (滴滴喀喀湖)"] },
          { name: "哥伦比亚", cities: ["波哥大 (Bogota)", "麦德林 (Medellin)", "卡塔赫纳 (Cartagena)", "卡利", "巴兰基亚"] },
          { name: "厄瓜多尔", cities: ["基多 (Quito)", "瓜亚基尔", "加拉帕戈斯群岛 (Galapagos)", "昆卡"] },
          { name: "委内瑞拉", cities: ["加拉加斯 (Caracas)", "马拉开波", "巴伦西亚", "天使瀑布地区"] },
          { name: "乌拉圭", cities: ["蒙得维的亚 (Montevideo)", "埃斯特角城", "科洛尼亚"] },
          { name: "玻利维亚", cities: ["拉巴斯 (La Paz)", "乌尤尼 (天空之镜)", "圣克鲁斯", "苏克雷"] },
          { name: "巴拉圭", cities: ["亚松森 (Asuncion)", "东方市", "恩卡纳西翁"] },
          { name: "圭亚那及苏里南", cities: ["乔治敦 (Georgetown)", "帕拉马里博 (Paramaribo)", "卡宴 (法属圭亚那)"] }
        ]
      }
    ]
  },
  {
    continent: "非洲 (Africa)",
    regions: [
      {
        name: "北非",
        countries: [
          {
            name: "埃及",
            cities: ["开罗 (Cairo)", "亚历山大 (Alexandria)", "卢克索 (Luxor)", "阿斯旺 (Aswan)", "沙姆沙伊赫 (红海)", "赫尔格达"]
          },
          {
            name: "摩洛哥",
            cities: ["卡萨布兰卡 (Casablanca)", "马拉喀什 (Marrakech)", "舍夫沙万 (蓝色小镇)", "非斯 (Fes)", "拉巴特 (Rabat)", "丹吉尔"]
          },
          { name: "突尼斯", cities: ["突尼斯市 (Tunis)", "迦太基", "苏塞", "哈马马特", "西迪布赛义德"] },
          { name: "阿尔及利亚", cities: ["阿尔及尔 (Algiers)", "奥兰 (Oran)", "君士坦丁", "安纳巴"] },
          { name: "利比亚", cities: ["的黎波里 (Tripoli)", "班加西", "米苏拉塔"] },
          { name: "苏丹与南苏丹", cities: ["喀土穆 (Khartoum)", "苏丹港", "朱巴 (Juba)"] },
          { name: "马德拉与亚速尔(葡)", cities: ["丰沙尔 (Funchal)", "蓬塔德尔加达"] }
        ]
      },
      {
        name: "东非",
        countries: [
          {
            name: "肯尼亚",
            cities: ["内罗毕 (Nairobi)", "蒙巴萨 (Mombasa)", "马赛马拉 (动物大迁徙)", "安博塞利", "纳库鲁湖"]
          },
          {
            name: "坦桑尼亚",
            cities: ["达累斯萨拉姆 (Dar es Salaam)", "桑给巴尔岛 (Zanzibar)", "乞力马扎罗 (阿鲁沙)", "塞伦盖蒂", "多多马"]
          },
          { name: "埃塞俄比亚", cities: ["亚的斯亚贝巴 (Addis Ababa)", "巴hir达尔", "贡德尔", "拉利贝拉 (岩石教堂)"] },
          { name: "毛里求斯", cities: ["路易港 (Port Louis)", "大湾", "黑河区", "鹿岛"] },
          { name: "塞舌尔", cities: ["维多利亚 (Victoria)", "普拉兰岛", "拉迪格岛"] },
          { name: "卢旺达", cities: ["基加利 (Kigali)", "火山国家公园", "吉塞尼"] },
          { name: "乌干达", cities: ["坎帕拉 (Kampala)", "恩德培", "金贾 (尼罗河源头)"] },
          { name: "马达加斯加", cities: ["塔那那利佛 (Antananarivo)", "穆龙达瓦 (猴面包树大道)", "圣玛丽岛", "诺西贝岛"] },
          { name: "吉布提与索马里", cities: ["吉布提市 (Djibouti)", "摩加迪沙 (Mogadishu)", "哈尔格萨"] }
        ]
      },
      {
        name: "西非与南非",
        countries: [
          {
            name: "南非",
            cities: ["开普敦 (Cape Town)", "约翰内斯堡 (Johannesburg)", "德班 (Durban)", "比勒陀利亚 (Pretoria)", "伊丽莎白港", "克鲁格国家公园"]
          },
          { name: "尼日利亚", cities: ["拉各斯 (Lagos)", "阿布贾 (Abuja)", "伊巴丹", "卡诺", "哈科特港"] },
          { name: "塞内加尔", cities: ["达喀尔 (Dakar)", "圣路易", "玫瑰湖地区"] },
          { name: "加纳", cities: ["阿克拉 (Accra)", "库马西", "海岸角"] },
          { name: "科特迪瓦", cities: ["阿比让 (Abidjan)", "亚穆苏克罗 (Yamoussoukro)", "圣佩德罗"] },
          { name: "纳米比亚", cities: ["温得和克 (Windhoek)", "鲸湾港 (Walvis Bay)", "苏丝斯黎 (红沙漠)", "埃托沙"] },
          { name: "博茨瓦纳", cities: ["哈博罗内 (Gaborone)", "马un (奥卡万戈三角洲)", "卡萨内"] },
          { name: "津巴布韦与赞比亚", cities: ["哈拉雷 (Harare)", "卢萨卡 (Lusaka)", "维多利亚瀑布城 (Victoria Falls)"] },
          { name: "加那利群岛(西)", cities: ["拉斯帕尔马斯 (大加那利)", "圣克鲁斯 (特内里费)"] }
        ]
      },
      {
        name: "中非",
        countries: [
          { name: "喀麦隆", cities: ["雅温得 (Yaounde)", "杜阿拉 (Douala)", "加鲁阿"] },
          { name: "刚果共和国与刚果金", cities: ["金沙萨 (Kinshasa)", "布拉柴维尔 (Brazzaville)", "卢本巴希", "黑角"] },
          { name: "加蓬", cities: ["利伯维尔 (Libreville)", "让蒂尔港"] },
          { name: "赤道几内亚与中非", cities: ["马拉博 (Malabo)", "巴塔", "班吉 (Bangui)", "恩贾梅纳 (乍得)"] }
        ]
      }
    ]
  },
  {
    continent: "大洋洲 (Oceania)",
    regions: [
      {
        name: "澳大利亚与新西兰",
        countries: [
          {
            name: "澳大利亚",
            provinces: [
              { name: "新南威尔士州 (NSW)", cities: ["悉尼 (Sydney)", "纽卡斯尔 (Newcastle)", "卧龙岗 (Wollongong)", "蓝山地区", "拜伦湾"] },
              { name: "维多利亚州 (VIC)", cities: ["墨尔本 (Melbourne)", "吉朗 (Geelong)", "大洋路沿线", "巴拉瑞特", "莫宁顿半岛"] },
              { name: "昆士兰州 (QLD)", cities: ["布里斯班 (Brisbane)", "黄金海岸 (Gold Coast)", "凯恩斯 (大堡礁)", "阳光海岸", "圣灵群岛"] },
              { name: "西澳与南澳", cities: ["珀斯 (Perth)", "弗里曼特尔", "阿德莱德 (Adelaide)", "芭萝莎谷", "袋鼠岛"] },
              { name: "塔斯马尼亚及领地", cities: ["霍巴特 (Hobart)", "朗塞斯顿", "堪培拉 (首都领地)", "达尔文 (北领地)", "乌鲁鲁 (红土中心)"] }
            ]
          },
          {
            name: "新西兰",
            provinces: [
              { name: "北岛", cities: ["奥克兰 (Auckland)", "惠灵顿 (Wellington)", "罗托鲁瓦 (Rotorua)", "陶波", "霍克斯湾", "岛屿湾"] },
              { name: "南岛", cities: ["基督城 (Christchurch)", "皇后镇 (Queenstown)", "瓦纳卡 (Wanaka)", "蒂卡波湖", "达尼丁", "库克山"] }
            ]
          }
        ]
      },
      {
        name: "太平洋群岛与美/法属海岛",
        countries: [
          {
            name: "斐济群岛",
            cities: ["楠迪 (Nadi)", "苏瓦 (Suva)", "玛玛努卡群岛", "亚萨瓦群岛", "珊瑚海岸"]
          },
          {
            name: "法属波利尼西亚",
            cities: ["帕皮提 (Papeete)", "大溪地 (Tahiti)", "波拉波拉岛 (Bora Bora)", "莫雷阿岛", "赖阿特阿岛"]
          },
          { name: "关岛与塞班(美)", cities: ["塞班岛 (Saipan)", "天宁岛", "关岛 (阿加尼亚/杜梦湾)", "罗塔岛"] },
          { name: "巴布亚新几内亚", cities: ["莫尔兹比港 (Port Moresby)", "拉包尔", "芒特哈根", "莱城"] },
          { name: "瓦努阿图", cities: ["维拉港 (Port Vila)", "卢甘维尔", "塔纳岛 (活火山)"] },
          { name: "所罗门群岛", cities: ["霍尼亚拉 (Honiara)", "吉佐", "奥基"] },
          { name: "萨摩亚及美属萨摩亚", cities: ["阿皮亚 (Apia)", "帕果帕果 (Pago Pago)", "乌波卢岛"] },
          { name: "帕劳", cities: ["科罗尔 (Koror)", "梅莱凯奥克", "水母湖地区"] },
          { name: "汤加", cities: ["努库阿洛法 (Nuku'alofa)", "瓦瓦乌群岛"] },
          { name: "库克群岛(新)", cities: ["拉罗汤加岛 (阿瓦鲁阿)", "艾图塔基岛"] },
          { name: "新喀里多尼亚(法)", cities: ["努美阿 (Noumea)", "松树岛"] },
          { name: "密克罗尼西亚及马绍尔", cities: ["帕利基尔 (Palikir)", "波纳佩岛", "马朱罗 (Majuro)", "夸贾林"] },
          { name: "基里巴斯及图瓦卢", cities: ["塔拉瓦 (Tarawa)", "圣诞岛", "富纳富提 (Funafuti)"] },
          { name: "瑙鲁及其他", cities: ["亚伦 (Yaren)", "纽埃 (阿洛菲)", "皮特凯恩岛 (亚当斯敦)"] }
        ]
      }
    ]
  }
];
