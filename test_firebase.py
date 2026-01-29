import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore

#Add your json path here to test the firebase connection
CREDENTIAL_PATH = 'firebaseAccountKey.json'
TEST_UID = "2u3FH9T6MeVkCFgJKtHJ"
TEST_DATA = {
    "full_name": "Test User", 
    "user_role": "standard",
}

try:
    cred = credentials.Certificate(CREDENTIAL_PATH)
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("Firebase initialized successfully.")
except Exception as e:
    print(f"Error initializing Firebase: {e}")
    exit()


def save_document(uid, data):
    try:
        doc_ref = db.collection('users').document(uid)
        doc_ref.set(data)
        print(f"Document SAVED for UID: {uid}")
    except Exception as e:
        print(f"Error saving data: {e}")

def retrieve_document(uid):
    """Retrieves the document directly by its UID."""
    try:
        doc_ref = db.collection('users').document(uid)
        user_snapshot = doc_ref.get()

        if user_snapshot.exists:
            user_data = user_snapshot.to_dict()
            print(f"\nDocument RETRIEVED successfully.")
            print(f"Name: {user_data.get('full_name')}")
            print(f"Role: {user_data.get('user_role')}")
        else:
            print(f"Document for UID {uid} does not exist.")
    except Exception as e:
        print(f"Error retrieving data: {e}")


if __name__ == "__main__":
    print("Starting Firebase Test...")
    
    save_document(TEST_UID, TEST_DATA)
    
    retrieve_document(TEST_UID)
    
    print("\nTest completed.")