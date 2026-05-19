# Setting Up SALES and OPERATOR Users

## Overview

To allow users to log in as SALES or OPERATOR team members, follow these steps. These roles cannot be assigned through self-signup; they must be created by an admin.

## How to Create SALES and OPERATOR Users

### Step 1: Access User Management
1. Log in as an ADMIN user
2. Navigate to `/users` (or use the admin dashboard menu)

### Step 2: Invite New User
1. Click the **"Invite new user"** button
2. Fill in the form:
   - **Email**: User's email address
   - **Full Name**: User's name
   - **Role**: Select `Sales` or `Operator`
   - **Branches**: Select the branch(es) they work in
3. Click **"Send invite"**

### Step 3: User Logs In
The user can now log in with their email and will be assigned the correct role.

## How to Update Existing User Roles

If a user signed up with role `PENDING` and you want to change them to SALES or OPERATOR:

1. Go to `/users` (admin only)
2. Find the user in the table
3. Click **"Edit"** 
4. Change their role from `PENDING` to `Sales` or `Operator`
5. Click **"Save"**
6. The user should log out and log back in for the change to take effect

## Troubleshooting

### User still has PENDING role after edit
- **Solution**: User needs to log out completely and log back in. The role cache is cleared on next login.

### User can't access their role-specific pages
- **Solution**: Verify that:
  1. Their role is set correctly in `/users` page (not PENDING)
  2. They've logged out and logged back in after role change
  3. Check browser console for errors

### Can't invite user - getting "user already exists" error
- **Solution**: The user has already signed up. Use the Edit function to change their role from PENDING to the desired role.

## Role-Specific Pages

After login, users are automatically routed to their role-specific page:
- **Admin**: `/admin/dashboard`
- **Manager**: `/manager`
- **Sales**: `/sales`
- **Operator**: `/operator`
- **Warehouse**: `/warehouse`
- **Packaging**: `/packaging`

## Technical Details

When a user logs in:
1. The system fetches their role from the Prisma database
2. If their role has been updated by an admin, it syncs to Supabase metadata
3. The middleware checks their role and routes them appropriately
4. They are granted access to pages matching their role

