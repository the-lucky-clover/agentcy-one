import google.generativeai as genai

genai.configure(api_key="AIzaSyCK5TxMQ5f6OZOkRXNhkZ-ngdkchQLRTA0")

model = genai.GenerativeModel("gemini-1.5-flash")

def get_ai_response(user_message):
    try:
        response = model.generate_content(user_message)
        return response.text.strip()
    except Exception as e:
        return f"Error generating response: {str(e)}"
