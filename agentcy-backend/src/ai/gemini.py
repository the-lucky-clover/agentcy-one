import os
import google.generativeai as genai

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-1.5-flash")

def get_ai_response(prompt: str) -> str:
    response = model.generate_content(prompt)
    return response.text.strip()

def generate_image(prompt: str) -> str:
    image_model = genai.GenerativeModel("gemini-pro-vision")
    response = image_model.generate_content(prompt)
    # Placeholder: Replace with actual image URL from your image hosting logic
    return "https://via.placeholder.com/512x512?text=Generated+Image"

def plan_task(prompt: str):
    plan_prompt = f"Break this task into detailed steps: {prompt}"
    response = model.generate_content(plan_prompt)
    return [step.strip() for step in response.text.split("\n") if step.strip()]

def route_tool(prompt: str):
    prompt_lower = prompt.lower()
    if "image" in prompt_lower or "visualize" in prompt_lower:
        return {
            "message": f"Here’s an image I created based on your prompt.",
            "tools_used": ["image_generation"]
        }

    if "steps" in prompt_lower or "plan" in prompt_lower or "how do I" in prompt_lower:
        steps = plan_task(prompt)
        return {
            "message": "\n".join(steps),
            "tools_used": ["task_planning"]
        }

    text = get_ai_response(prompt)
    return {
        "message": text,
        "tools_used": ["text_generation"]
    }
