from flask import Flask, request, redirect, session, url_for, render_template, jsonify, Blueprint
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
import os
import threading
import time
import uuid
from flask import jsonify
import pickle
import json
from datetime import timedelta
import base64
from utils import EmailClient, gen_categories, QuerySaver, CategoryStorage
import random
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Create shared instances that will be used across blueprints
email_client = EmailClient()
query = QuerySaver()

def init_app(app):
    """Initialize all blueprints with the Flask app"""
    # Make shared instances available to the app
    app.email_client = email_client
    app.query = query
    
    # Import and register blueprints (import here to avoid circular imports)
    from .email_functions.emails import emails_bp
    from .folder_view.categories import categories_bp
    
    app.register_blueprint(emails_bp)
    app.register_blueprint(categories_bp)

# Export the function
__all__ = ['init_app', 'email_client', 'query']