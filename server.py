import random
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="Mini Phone OS - Spicy Monopoly & EchoVault MCP Server")

# 开启跨域允许前端前端直连
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 内存战局缓存
monopoly_game_state = {}

# 1. 探测接口 (前端测试连通性)
@app.get("/tools")
async def get_tools():
    return {
        "status": "online",
        "tools": [
            {"name": "roll_dice", "description": "掷骰子计算点数"},
            {"name": "buy_property", "description": "购买地产"},
            {"name": "trigger_spicy_event", "description": "触发辛辣大冒险事件"},
            {"name": "init_game", "description": "初始化游戏战局"}
        ]
    }

# 2. 核心 MCP 工具调用路由
@app.post("/call")
async def call_tool(request: Request):
    payload = await request.json()
    tool_name = payload.get("name")
    args = payload.get("arguments", {})

    print(f"[MCP TOOL CALL] 执行工具: {tool_name}, 参数: {args}")

    # 1) 初始化战局
    if tool_name == "init_game":
        char_name = args.get("char_name", "Char")
        monopoly_game_state["active_game"] = {
            "char_name": char_name,
            "starting_cash": args.get("starting_cash", 1500),
            "status": "in_progress"
        }
        return {"result": {"success": True, "message": f"战局已初始化，对手: {char_name}"}}

    # 2) 掷骰子
    elif tool_name == "roll_dice":
        player = args.get("player", "user")
        cur_pos = args.get("current_pos", 0)
        dice = random.randint(1, 6)
        new_pos = (cur_pos + dice) % 16
        return {
            "result": {
                "dice": dice,
                "old_pos": cur_pos,
                "new_pos": new_pos,
                "player": player
            }
        }

    # 3) 购买地产
    elif tool_name == "buy_property":
        tile_id = args.get("tile_id")
        player = args.get("player")
        price = args.get("price")
        return {
            "result": {
                "success": True,
                "message": f"玩家 {player} 成功买入地块 {tile_id}，消耗 ¥{price}"
            }
        }

    # 4) 触发辛辣事件
    elif tool_name == "trigger_spicy_event":
        task = args.get("task", "请向对方说一句真心话")
        player = args.get("player", "user")
        return {
            "result": {
                "event_type": "spicy_challenge",
                "target": player,
                "task": task
            }
        }

    # 默认保底
    return {"result": {"success": True, "data": args}}

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 MINI PHONE OS - MCP 服务已启动")
    print("📡 监听地址: http://127.0.0.1:8765")
    print("🎮 大富翁 (Spicy Monopoly) 与 🧠 记忆中枢 (EchoVault) 准备就绪")
    print("=" * 60)
    uvicorn.run(app, host="127.0.0.1", port=8765)
