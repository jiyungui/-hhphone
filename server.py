import random
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="Spicy Monopoly MCP Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 20 格标准地块库
BOARD_TILES = [
    {"id": 0, "name": "起点", "type": "start"},
    {"id": 1, "name": "任务", "type": "task"},
    {"id": 2, "name": "机会", "type": "chance"},
    {"id": 3, "name": "任务", "type": "task"},
    {"id": 4, "name": "商店", "type": "shop"},
    {"id": 5, "name": "任务", "type": "task"},
    {"id": 6, "name": "未知", "type": "unknown"},
    {"id": 7, "name": "任务", "type": "task"},
    {"id": 8, "name": "真心话", "type": "truth"},
    {"id": 9, "name": "任务", "type": "task"},
    {"id": 10, "name": "监狱", "type": "jail"},
    {"id": 11, "name": "任务", "type": "task"},
    {"id": 12, "name": "任务", "type": "task"},
    {"id": 13, "name": "机会", "type": "chance"},
    {"id": 14, "name": "真心话", "type": "truth"},
    {"id": 15, "name": "任务", "type": "task"},
    {"id": 16, "name": "未知", "type": "unknown"},
    {"id": 17, "name": "任务", "type": "task"},
    {"id": 18, "name": "机会", "type": "chance"},
    {"id": 19, "name": "任务", "type": "task"}
]

# 辛辣任务库 (含多维属性标签)
SPICY_TASK_DATABASE = {
    "medium": [
        {"title": "雕像挑战", "tags": ["触碰", "耐力"], "desc": "选择一个姿势静止保持3分钟，对方在此期间可以进行任意言语调侃和轻微接触。"},
        {"title": "言语规训", "tags": ["语言", "支配"], "desc": "用极其顺从且带有一丝羞耻的语气，向对方称呼其特定尊称并复述三句话。"},
        {"title": "视线对峙", "tags": ["眼神", "心跳"], "desc": "与对方进行60秒无间断近距离对视，率先移开视线或眨眼者接受额外指令。"},
        {"title": "触碰试探", "tags": ["触碰", "指令"], "desc": "闭上双眼，由对方引导你的手触碰其指定部位并描述此刻感受。"},
        {"title": "秘密告解", "tags": ["真心话", "隐秘"], "desc": "交代你最近一次对对方产生心动或占有欲的真实瞬间。"},
        {"title": "绝对服从", "tags": ["支配", "行动"], "desc": "在接下来的两个回合内，无条件答应对方提出的任意一个非过分要求。"}
    ]
}

game_sessions = {}

@app.get("/tools")
async def list_tools():
    return {
        "status": "online",
        "service": "spicy-monopoly-mcp",
        "tools": [
            {"name": "init_spicy_game", "description": "初始化辛辣大富翁战局"},
            {"name": "roll_dice", "description": "掷骰子计算位移与地块事件"},
            {"name": "swap_task", "description": "消耗金币换一道任务"},
            {"name": "skip_task", "description": "跳过当前任务"}
        ]
    }

@app.post("/call")
async def handle_tool_call(request: Request):
    data = await request.json()
    tool_name = data.get("name")
    args = data.get("arguments", {})

    print(f"[SPICY MCP] 执行工具: {tool_name} -> {args}")

    if tool_name == "init_spicy_game":
        game_id = f"cd{random.randint(100000, 999999)}"
        game_sessions[game_id] = {
            "game_id": game_id,
            "round": 1,
            "max_rounds": args.get("max_rounds", 12),
            "intensity": args.get("intensity", "medium"),
            "safety_word": "404",
            "char_name": args.get("char_name", "Char"),
            "user_name": args.get("user_name", "User")
        }
        return {"result": {"success": True, "game_id": game_id, "session": game_sessions[game_id]}}

    elif tool_name == "roll_dice":
        dice = random.randint(1, 6)
        cur_pos = args.get("current_pos", 0)
        new_pos = (cur_pos + dice) % 20
        tile = BOARD_TILES[new_pos]
        
        # 随机抽取当前强度任务
        tasks = SPICY_TASK_DATABASE.get("medium")
        picked_task = random.choice(tasks)

        return {
            "result": {
                "dice": dice,
                "new_pos": new_pos,
                "tile": tile,
                "task": picked_task
            }
        }

    elif tool_name == "swap_task":
        tasks = SPICY_TASK_DATABASE.get("medium")
        new_task = random.choice(tasks)
        return {"result": {"success": True, "new_task": new_task, "cost": 1}}

    elif tool_name == "skip_task":
        return {"result": {"success": True, "message": "任务已跳过", "cost": 1}}

    return {"result": {"success": True, "data": args}}

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 SPICY MONOPOLY (辛辣大富翁) MCP 服务已启动")
    print("📡 监听地址: http://127.0.0.1:8765")
    print("=" * 60)
    uvicorn.run(app, host="127.0.0.1", port=8765)
