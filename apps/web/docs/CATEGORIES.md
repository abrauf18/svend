### Budget Categories and Subcategories - Summary

#### 1. **Overview of Categories and Subcategories**
   - The application includes built-in categories and subcategories for budgeting and spending tracking.
   - Each transaction, whether sourced from Plaid or other integrations, will automatically map to these built-in categories and subcategories.
   - **Subcategory Requirement**: All transactions must be assigned to a specific subcategory, meaning a transaction cannot be mapped only to a main category without a subcategory.

#### 2. **User View and Modification Restrictions**
   - **Visibility**: Users can view all built-in categories and subcategories under their “Budget” or “Spending Tracking” tab.
   - **Restrictions on Built-ins**: Users cannot modify, rename, or delete any of the built-in categories or subcategories.  
   - **Example**: For the category *Utilities*, a subcategory like *Power* cannot be renamed or removed by the user.

#### 3. **Tracking Options: Simple vs. Advanced Mode**
   - Users can choose between **Simple** or **Advanced tracking modes** for any given category:
     - **Simple Mode**: The user sets a budget for the main category alone, tracking all spending within it as a single item. Example: A monthly budget for the *Utilities* category.
     - **Advanced Mode**: Enables tracking at the subcategory level rather than the parent category level. Each subcategory (e.g., *Power*, *Sewage*) will have its own budget, acting as the source of truth for the overall budget of the main category.
     - **Source of Truth in Advanced Mode**: Spending is tracked via subcategories exclusively, providing detailed tracking through each child subcategory under the main category.

#### 4. **Custom Categories and Subcategories**
   - Users can create custom categories and subcategories if they want more tailored control or additional classifications.
   - **Base Category Selection**: When creating a new custom category, users must select a corresponding built-in category as its base. 
   - **Inherited Subcategories**: Upon creating a custom category based on a built-in category, all subcategories of the built-in are automatically included in the new custom category.
   - **Full Control over Custom Subcategories**: Users can rename, delete, or add subcategories under their custom categories.
   - **Subcategory Requirement for Custom Categories**: Since a subcategory is required for all transactions, deleting all subcategories from a custom category renders it unusable for classifying transactions.

#### 5. **Example Scenario**
   - If a user wishes to create a custom *Shopping* category specific to *Amazon*, they would:
     - Base this custom category on the existing *Shopping* category.
     - The custom *Amazon* category would inherit all subcategories under *Shopping*, which can then be modified at the user's discretion.
     - If they remove all subcategories from *Amazon*, transactions cannot be categorized under this custom category, as every transaction requires a subcategory.

#### 6. **User Guidance on Tracking and Categorization**
   - Users can switch between Simple and Advanced modes depending on the granularity desired for tracking each category.
   - The system will inform users about the subcategory requirement, especially when creating or modifying custom categories.