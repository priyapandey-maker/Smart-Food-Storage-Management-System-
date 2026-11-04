from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models import FoodCatalogue

# Predefined initial food catalogue items based on official food safety guidelines
SEED_CATALOGUE_ITEMS: List[Dict[str, Any]] = [
    {
        "name": "Fresh Milk",
        "category": "Dairy",
        "storage_type": "REFRIGERATED",
        "max_temp_c": 4.0,
        "default_location": "Refrigerator",
        "storage_guidance": "Store in refrigerator at or below 4°C (40°F). Keep tightly closed in its original carton or bottle.",
        "reference_title": "FoodSafety.gov – Cold Food Storage Chart",
        "reference_url": "https://www.foodsafety.gov/food-safety-charts/cold-food-storage-charts",
    },
    {
        "name": "Raw Chicken Breast",
        "category": "Meat and poultry",
        "storage_type": "REFRIGERATED",
        "max_temp_c": 4.0,
        "default_location": "Refrigerator",
        "storage_guidance": "Store in refrigerator at or below 4°C (40°F). Keep wrapped securely on the lowest shelf to prevent juices dripping onto other foods.",
        "reference_title": "USDA FSIS – Chicken Storage Times",
        "reference_url": "https://ask.fsis.usda.gov/article/What-are-suggested-refrigerator-storage-times-for-chicken",
    },
    {
        "name": "Raw Ground Beef",
        "category": "Meat and poultry",
        "storage_type": "REFRIGERATED",
        "max_temp_c": 4.0,
        "default_location": "Refrigerator",
        "storage_guidance": "Store in refrigerator at or below 4°C (40°F) in original packaging or sealed airtight container.",
        "reference_title": "USDA FSIS – Meat Storage Guidelines",
        "reference_url": "https://ask.fsis.usda.gov/article/How-long-can-I-keep-meat-in-the-refrigerator",
    },
    {
        "name": "Fresh Fish Fillets",
        "category": "Seafood",
        "storage_type": "REFRIGERATED",
        "max_temp_c": 4.0,
        "default_location": "Refrigerator",
        "storage_guidance": "Store in refrigerator at or below 4°C (40°F) wrapped tightly or sealed in an airtight container.",
        "reference_title": "FoodSafety.gov – Cold Food Storage Chart",
        "reference_url": "https://www.foodsafety.gov/food-safety-charts/cold-food-storage-charts",
    },
    {
        "name": "Fresh Shell Eggs",
        "category": "Eggs",
        "storage_type": "REFRIGERATED",
        "max_temp_c": 4.0,
        "default_location": "Refrigerator",
        "storage_guidance": "Store in refrigerator at or below 4°C (40°F) in their original carton on an inside shelf, not in the door.",
        "reference_title": "FoodSafety.gov – 4 Steps to Food Safety",
        "reference_url": "https://www.foodsafety.gov/keep-food-safe/4-steps-to-food-safety",
    },
    {
        "name": "Fresh Cut Produce",
        "category": "Produce",
        "storage_type": "REFRIGERATED",
        "max_temp_c": 4.0,
        "default_location": "Refrigerator",
        "storage_guidance": "Store cut vegetables and fruits in refrigerator at or below 4°C (40°F) in clean, covered containers.",
        "reference_title": "FoodSafety.gov – 4 Steps to Food Safety",
        "reference_url": "https://www.foodsafety.gov/keep-food-safe/4-steps-to-food-safety",
    },
    {
        "name": "Frozen Vegetables",
        "category": "Frozen foods",
        "storage_type": "FROZEN",
        "max_temp_c": -18.0,
        "default_location": "Freezer",
        "storage_guidance": "Keep frozen at or below -18°C (0°F) in airtight, moisture-resistant packaging.",
        "reference_title": "FoodSafety.gov – 4 Steps to Food Safety",
        "reference_url": "https://www.foodsafety.gov/keep-food-safe/4-steps-to-food-safety",
    },
    {
        "name": "Cooked Leftovers",
        "category": "Cooked leftovers",
        "storage_type": "REFRIGERATED",
        "max_temp_c": 4.0,
        "default_location": "Refrigerator",
        "storage_guidance": "Refrigerate within 2 hours of cooking at or below 4°C (40°F) in shallow, airtight containers.",
        "reference_title": "FoodSafety.gov – 4 Steps to Food Safety",
        "reference_url": "https://www.foodsafety.gov/keep-food-safe/4-steps-to-food-safety",
    },
    {
        "name": "Dry White Rice",
        "category": "Pantry/dry goods",
        "storage_type": "AMBIENT",
        "max_temp_c": None,
        "default_location": "Pantry",
        "storage_guidance": "Store in a cool, clean, and dry pantry location in an airtight container away from moisture, heat, and direct sunlight.",
        "reference_title": "FoodSafety.gov – 4 Steps to Food Safety",
        "reference_url": "https://www.foodsafety.gov/keep-food-safe/4-steps-to-food-safety",
    },
    {
        "name": "Dry Pasta",
        "category": "Pantry/dry goods",
        "storage_type": "AMBIENT",
        "max_temp_c": None,
        "default_location": "Pantry",
        "storage_guidance": "Store in a cool, dry place in an airtight container to protect against humidity and pests.",
        "reference_title": "FoodSafety.gov – 4 Steps to Food Safety",
        "reference_url": "https://www.foodsafety.gov/keep-food-safe/4-steps-to-food-safety",
    },
]


def seed_catalogue_data(db: Session) -> int:
    """Seed predefined food catalogue items into the database.

    Idempotent operation: items are inserted only if an item with the same name
    does not already exist.

    Returns the number of new records inserted.
    """
    existing_names = {
        name for (name,) in db.query(FoodCatalogue.name).all()
    }

    added_count = 0
    for item_data in SEED_CATALOGUE_ITEMS:
        if item_data["name"] not in existing_names:
            food_item = FoodCatalogue(**item_data)
            db.add(food_item)
            added_count += 1

    if added_count > 0:
        db.commit()

    return added_count

